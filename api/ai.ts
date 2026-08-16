// AI service layer — OpenAI-compatible chat completions (Moonshot/Kimi by default).
// Configure via .env:
//   AI_API_KEY=sk-...
//   AI_BASE_URL=https://api.moonshot.ai/v1
//   AI_MODEL=kimi-k2.5
//
// All functions throw AIUnavailableError when no key is configured, and
// AIRequestError on API failures. JSON responses are validated and repaired.

export class AIUnavailableError extends Error {
  constructor() {
    super(
      "AI is not configured yet. Add AI_API_KEY to the server .env file and restart."
    );
    this.name = "AIUnavailableError";
  }
}

export class AIRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIRequestError";
  }
}

/** Content was blocked by the provider's safety filter — caller may soften and retry. */
export class AIContentFilterError extends Error {
  constructor() {
    super("The AI provider rejected this content.");
    this.name = "AIContentFilterError";
  }
}

const BASE_URL = process.env.AI_BASE_URL ?? "https://api.moonshot.ai/v1";
const MODEL = process.env.AI_MODEL ?? "kimi-k2.5";

function apiKey(): string {
  const key = process.env.AI_API_KEY?.trim();
  if (!key) throw new AIUnavailableError();
  return key;
}

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(messages: ChatMessage[], temperature = 0.3): Promise<string> {
  const key = apiKey();
  // - kimi-k3 rejects any temperature other than 1 → retry with 1.
  // - Disabling "thinking" roughly halves latency on reasoning models → try it,
  //   and fall back silently if the API/model doesn't accept the parameter.
  const attempt = (temp: number, noThinking: boolean) =>
    fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: temp,
        response_format: { type: "json_object" },
        ...(noThinking ? { thinking: { type: "disabled" } } : {}),
      }),
      signal: AbortSignal.timeout(115_000),
    });
  let res: Response;
  try {
    res = await attempt(temperature, true);
    if (res.status === 400) {
      let body = await res.clone().text().catch(() => "");
      if (body.includes("thinking")) {
        res = await attempt(temperature, false);
        if (res.status === 400) body = await res.clone().text().catch(() => "");
      }
      // Models may pin temperature to a specific value (e.g. "only 0.6 is allowed").
      if (res.status === 400 && body.includes("temperature")) {
        const m = body.match(/only ([\d.]+) is allowed/);
        res = await attempt(m ? parseFloat(m[1]) : 1, body.includes("thinking") === false);
      }
    }
  } catch (e) {
    throw new AIRequestError(`Network error contacting AI: ${String(e)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Provider-side content moderation rejection — treat as retryable with
    // a softened prompt rather than a hard failure.
    if (res.status === 400 && /reject|content|risk|moderat|censor|safe/i.test(text)) {
      throw new AIContentFilterError();
    }
    throw new AIRequestError(
      `AI request failed (${res.status}): ${text.replace(/<[^>]*>/g, " ").slice(0, 200)}`
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new AIRequestError("AI service returned an unexpected non-JSON response.");
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AIRequestError("AI returned an empty response.");
  return content;
}

/** Parse a JSON object out of model output, tolerating code fences / extra text. */
function parseJsonObject<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AIRequestError("AI response was not valid JSON.");
  }
  try {
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    throw new AIRequestError("AI response could not be parsed as JSON.");
  }
}

// ── Domain payloads ─────────────────────────────────────────────────────────

export type PersonPayload = {
  name: string;
  title: string;
  country: string;
  lat: number;
  lng: number;
  summary: string;
  suggestions: { name: string; reason: string }[];
  companies: { name: string; summary: string; role: string; timeline: string; ownership?: "state" | "partial" | "private" }[];
  parties: { name: string; summary: string; role: string; timeline: string }[];
};

const PERSON_SYSTEM = `You are the knowledge engine of a geopolitical network-mapping website.
Your job is to return rigorous, well-sourced-style factual profiles of real political figures, government officials, business leaders and public persons.

Rules:
- Output ONLY a single JSON object. No markdown, no commentary.
- Base everything on verifiable public record (official biographies, government records, reputable journalism, court/financial disclosures). Do not invent relationships.
- When describing relationships that involve contested or unverified claims, use cautious language ("reportedly", "according to public reporting") and prefer well-documented facts.
- lat/lng: coordinates of the city where the person primarily resides or works — NOT just the country capital if they are known to live/work elsewhere (e.g. a Saint Petersburg-based figure gets Saint Petersburg, a figure based in Sochi gets Sochi). Only use the capital when it genuinely is their primary base. Precision to ~0.1 degree is fine.
- summary: 80-140 words, neutral, factual.
- suggestions: up to 6 real, living-or-recent people with the strongest documented political, financial or ideological relationships to this person. reason: one sentence explaining why they matter (close association, financial influence, political sway). Never list more than 6.
- companies: organizations/companies the person invested in, worked for, founded, or is documented to be indebted to/influenced by. Each with summary (1-2 sentences), role, timeline (e.g. "1998–2004"), and ownership: exactly one of "state" (state-owned enterprise), "partial" (state holds a significant stake but not full control), or "private". Government bodies and public offices are NOT companies — for those, omit ownership.
- parties: political parties the person has belonged to, with summary (1-2 sentences), role, timeline.
- All fields are required; use [] for empty lists.
- NEVER leave title, country, lat or lng empty — always provide your best determination (title = their most notable current/recent role; country = their country of citizenship or primary political activity, as a common short name like "Russia", "United States", "United Kingdom").`;

export async function resolvePerson(query: string): Promise<
  | { kind: "typo"; didYouMean: string }
  | { kind: "not_found" }
  | { kind: "person"; person: PersonPayload }
> {
  const fetchProfile = async () => {
    const raw = await chat([
      { role: "system", content: PERSON_SYSTEM },
      {
        role: "user",
        content: `User search query: "${query}"

Decide:
1. If the query is clearly a misspelling/typo of a specific well-known person, respond {"kind":"typo","didYouMean":"Correct Full Name"}.
2. If the query does not correspond to any identifiable real public figure, respond {"kind":"not_found"}.
3. Otherwise respond {"kind":"person","person":{...}} with the full profile object for the person the user most likely means (use their canonical full name).`,
      },
    ]);
    const parsed = parseJsonObject<Record<string, unknown>>(raw);
    if (parsed.kind === "typo" && typeof parsed.didYouMean === "string") {
      return { kind: "typo" as const, didYouMean: parsed.didYouMean };
    }
    if (parsed.kind === "not_found") return { kind: "not_found" as const };
    const p = parsed.person as PersonPayload | undefined;
    if (!p || typeof p.name !== "string") {
      throw new AIRequestError("AI returned a malformed profile.");
    }
    return { kind: "person" as const, person: normalizePerson(p) };
  };

  const result = await (async () => {
    try {
      return await fetchProfile();
    } catch (e) {
      if (!(e instanceof AIContentFilterError)) throw e;
      // Provider safety filters can trip on certain heads of state. Retry
      // once with a strictly encyclopedic framing of the same query.
      const soft = await chat([
        { role: "system", content: PERSON_SYSTEM },
        {
          role: "user",
          content: `For a neutral reference atlas of world leaders and public figures, provide the standard encyclopedia-style profile for the person identified by the search term: "${query}". If it is a misspelling, respond {"kind":"typo","didYouMean":"Correct Full Name"}; if no such public figure exists, respond {"kind":"not_found"}; otherwise respond {"kind":"person","person":{...}}.`,
        },
      ]);
      const parsed = parseJsonObject<Record<string, unknown>>(soft);
      if (parsed.kind === "typo" && typeof parsed.didYouMean === "string") {
        return { kind: "typo" as const, didYouMean: parsed.didYouMean };
      }
      if (parsed.kind === "not_found") return { kind: "not_found" as const };
      const p = parsed.person as PersonPayload | undefined;
      if (!p || typeof p.name !== "string") {
        throw new AIRequestError("AI returned a malformed profile.");
      }
      return { kind: "person" as const, person: normalizePerson(p) };
    }
  })();
  // The model occasionally omits required scalar fields; retry once before giving up.
  if (
    result.kind === "person" &&
    (!result.person.title || !result.person.country || !result.person.lat)
  ) {
    const retry = await fetchProfile().catch(() => null);
    if (retry?.kind === "person") {
      const a = result.person;
      const b = retry.person;
      a.title = a.title || b.title;
      a.country = a.country || b.country;
      a.lat = a.lat || b.lat;
      a.lng = a.lng || b.lng;
    }
  }
  return result;
}

function normalizePerson(p: PersonPayload): PersonPayload {
  return {
    name: String(p.name),
    title: String(p.title ?? ""),
    country: String(p.country ?? ""),
    lat: Number(p.lat ?? 0),
    lng: Number(p.lng ?? 0),
    summary: String(p.summary ?? ""),
    suggestions: (Array.isArray(p.suggestions) ? p.suggestions : [])
      .slice(0, 6)
      .map((s) => ({ name: String(s.name ?? ""), reason: String(s.reason ?? "") }))
      .filter((s) => s.name),
    companies: (Array.isArray(p.companies) ? p.companies : []).map((c) => {
      const o = String(c.ownership ?? "").toLowerCase();
      return {
        name: String(c.name ?? ""),
        summary: String(c.summary ?? ""),
        role: String(c.role ?? ""),
        timeline: String(c.timeline ?? ""),
        ownership: o === "state" || o === "partial" || o === "private" ? (o as "state" | "partial" | "private") : undefined,
      };
    }),
    parties: (Array.isArray(p.parties) ? p.parties : []).map((c) => ({
      name: String(c.name ?? ""),
      summary: String(c.summary ?? ""),
      role: String(c.role ?? ""),
      timeline: String(c.timeline ?? ""),
    })),
  };
}

const CONNECTION_SYSTEM = `You are the relationship-analysis engine of a geopolitical network-mapping website.
Output ONLY a single JSON object.

STEP 1 — Directness test. A tie between two people only counts as DIRECT if at least one of these is documented in the public record:
- direct financial ties: payments, contracts, ownership stakes, debts, or business dealings between them;
- direct personal/bilateral dealings: one-on-one meetings, negotiations, appointments (one appointed/promoted/fired the other), direct working relationship (one served directly under/with the other), family ties;
- public statements of support or opposition that one has made about the other.
Second-hand connections do NOT count: merely belonging to the same party, government, or political system; sharing an ideology; knowing the same people; or being part of the same era. If no direct tie is documented, respond {"direct": false} and nothing else.

STEP 2 — If (and only if) a direct tie exists, write an intelligence-analyst-style assessment of their relationship. Cover as applicable: shared or conflicting strategic interests; ideological alignment; money flows between them; institutional history; personal rapport, patronage, rivalry or strain. Base everything on verifiable public record; use cautious language ("reportedly", "according to public reporting") for contested claims. 90-150 words.

STEP 3 — Interest-alignment matrix. Score each dimension 0-10 based on the documented record, weighting ACTIONS far above WORDS. Actions are: wars, proxy wars, military alliances, arms transfers, joint military exercises, sanctions imposed or circumvented, treaties signed and actually implemented, trade/energy flows, co-investment, debts, appointments, purges. Words are: speeches, communiqués, UN votes, mutual praise or condemnation. Rhetoric alone can never lift a dimension above 4. For each dimension give a one-sentence justification ("reason") that cites the ACTION behind the score, not what either side merely said.
- strategic (geopolitical/strategic interests): 10 = acting jointly on core objectives (joint ops, binding alliance), 7-9 = materially supporting each other's goals (arms, bases, intelligence), 5-6 = partially overlapping, 3-4 = unrelated/indifferent, 0-2 = direct strategic conflict (sanctions, proxy confrontation, active war).
- financial (financial interdependence): 10 = deep mutual dependence (major trade/energy/investment flows, co-ownership), 7-9 = significant, 5-6 = some shared financial interests, 3-4 = negligible, 0-2 = financial warfare (sanctions, asset freezes, blockades).
- trust (personal loyalty/trust): 10 = proven patronage/loyalty through purges or crises, 7-9 = durable alliance repeatedly acted on, 5-6 = functional working relationship, 3-4 = distant, 0-2 = rivalry, betrayal, or targeting each other.
- ideological (ideological alignment): 10 = same doctrine/movement with joint ideological projects, 7-9 = broad sympathy, 4-6 = unrelated, 0-3 = opposed ideologies actively promoted against each other.

STEP 3b — Adversary caps. After scoring, also output a "cap" on the overall score if any applies:
- 2 if the two people's states/forces are in active war or armed conflict with each other;
- 4 if they directly impose sanctions on each other or fight a documented proxy war;
- 5 if there are public threats, expelled diplomats, or severed relations between them;
- 10 otherwise (no cap).
No shared interest can exceed these caps: a pair at war never ranks above 2 no matter what else is true.
Format when direct: {"direct": true, "strength": <integer 1-10 how strong/documented the direct tie is>, "summary": "...", "tags": "political, financial", "alignment": {"strategic": 0-10, "financial": 0-10, "trust": 0-10, "ideological": 0-10, "cap": 2|4|5|10, "reasons": {"strategic": "...", "financial": "...", "trust": "...", "ideological": "..."}}} — tags: 1-3 comma-separated lowercase categories from: political, financial, ideological, familial, institutional, diplomatic.`;

/** Minimum directness score (1-10) for a tie to be created at all. */
const DIRECTNESS_THRESHOLD = 5;

/** Weights for the interest-alignment matrix (sum to 1). */
const ALIGNMENT_WEIGHTS = { strategic: 0.35, financial: 0.25, trust: 0.2, ideological: 0.2 } as const;

export type Alignment = {
  strategic: number;
  financial: number;
  trust: number;
  ideological: number;
  overall: number;
  cap: number;
  reasons: { strategic: string; financial: string; trust: string; ideological: string };
};

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10));
}

function clampCap(v: unknown): number {
  const n = Number(v);
  if (n <= 2) return 2;
  if (n <= 4) return 4;
  if (n <= 5) return 5;
  return 10;
}

function buildAlignment(raw: unknown): Alignment | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const reasons = (a.reasons ?? {}) as Record<string, unknown>;
  const strategic = clampScore(a.strategic);
  const financial = clampScore(a.financial);
  const trust = clampScore(a.trust);
  const ideological = clampScore(a.ideological);
  const cap = clampCap(a.cap);
  // Adversary caps are enforced deterministically here, so rhetoric in the
  // model's answer can never push a warring or sanctioned pair above its cap.
  const overall = Math.min(
    cap,
    Math.round(
      (strategic * ALIGNMENT_WEIGHTS.strategic +
        financial * ALIGNMENT_WEIGHTS.financial +
        trust * ALIGNMENT_WEIGHTS.trust +
        ideological * ALIGNMENT_WEIGHTS.ideological) * 100
    ) / 100
  );
  return {
    strategic,
    financial,
    trust,
    ideological,
    overall,
    cap,
    reasons: {
      strategic: String(reasons.strategic ?? ""),
      financial: String(reasons.financial ?? ""),
      trust: String(reasons.trust ?? ""),
      ideological: String(reasons.ideological ?? ""),
    },
  };
}

export async function describeConnection(
  a: { name: string; title: string },
  b: { name: string; title: string }
): Promise<{ direct: boolean; strength: number; summary: string; tags: string; alignment: Alignment | null }> {
  const call = (user: string) =>
    chat([
      { role: "system", content: CONNECTION_SYSTEM },
      { role: "user", content: user },
    ]);
  const directPrompt = `Assess whether a DIRECT connection exists between:\nA: ${a.name} — ${a.title}\nB: ${b.name} — ${b.title}`;
  let raw: string;
  try {
    raw = await call(directPrompt);
  } catch (e) {
    if (!(e instanceof AIContentFilterError)) throw e;
    // The provider's safety filter can trip on certain heads of state. Retry
    // with a strictly neutral, academic framing of the same request.
    try {
      raw = await call(
        `For an academic encyclopedia entry on international relations, assess whether these two officeholders have documented direct dealings (meetings, appointments, financial ties, or public statements about each other) and, if so, neutrally summarize them citing only well-known public facts:\nA: ${a.name} — ${a.title}\nB: ${b.name} — ${b.title}`
      );
    } catch (e2) {
      if (!(e2 instanceof AIContentFilterError)) throw e2;
      // Still blocked — anonymize the names; the analysis text applies to the
      // offices and is stored for the same pair of people.
      raw = await call(
        `For an academic encyclopedia entry on international relations, assess the documented direct bilateral dealings between the holders of these two offices in recent years — meetings, appointments, economic ties, public statements about each other:\nOffice A: ${a.title}\nOffice B: ${b.title}`
      );
    }
  }
  const parsed = parseJsonObject<{
    direct?: boolean;
    strength?: number;
    summary?: string;
    tags?: string;
    alignment?: unknown;
  }>(raw);
  const strength = Number(parsed.strength ?? 0);
  const direct = parsed.direct === true && strength >= DIRECTNESS_THRESHOLD;
  return {
    direct,
    strength,
    summary: String(parsed.summary ?? ""),
    tags: String(parsed.tags ?? "political"),
    alignment: direct ? buildAlignment(parsed.alignment) : null,
  };
}

const COMPANY_ANALYSIS_SYSTEM = `You are the corporate-affiliation analysis engine of a geopolitical network-mapping website.
Output ONLY a single JSON object: {"analysis": "..."}.
Given a real person and a real company/organization, analyze the person's documented affiliation with it: roles held, money received (salary, contracts, dividends, documented payments), influence exercised or received, ownership stakes, and any other verifiable ties.
Base everything on verifiable public record; use cautious language ("reportedly", "according to public reporting") for contested or unverified claims. 80-140 words.`;

export async function analyzeCompanyAffiliation(
  person: { name: string; title: string },
  companyName: string,
  known: { role: string; timeline: string; summary: string }
): Promise<string> {
  const raw = await chat([
    { role: "system", content: COMPANY_ANALYSIS_SYSTEM },
    {
      role: "user",
      content: `Analyze the affiliation between:\nPerson: ${person.name} — ${person.title}\nOrganization: ${companyName}\nAlready documented on the map: role "${known.role}" (${known.timeline}) — ${known.summary}`,
    },
  ]);
  const parsed = parseJsonObject<{ analysis?: string }>(raw);
  return String(parsed.analysis ?? "");
}
