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
  // Some models (e.g. kimi-k3) reject any temperature other than 1 — retry gracefully.
  const attempt = (temp: number) =>
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
      }),
    });
  let res: Response;
  try {
    res = await attempt(temperature);
    if (res.status === 400) {
      const body = await res.clone().text().catch(() => "");
      if (body.includes("temperature")) res = await attempt(1);
    }
  } catch (e) {
    throw new AIRequestError(`Network error contacting AI: ${String(e)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AIRequestError(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
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
  companies: { name: string; summary: string; role: string; timeline: string }[];
  parties: { name: string; summary: string; role: string; timeline: string }[];
};

const PERSON_SYSTEM = `You are the knowledge engine of a geopolitical network-mapping website.
Your job is to return rigorous, well-sourced-style factual profiles of real political figures, government officials, business leaders and public persons.

Rules:
- Output ONLY a single JSON object. No markdown, no commentary.
- Base everything on verifiable public record (official biographies, government records, reputable journalism, court/financial disclosures). Do not invent relationships.
- When describing relationships that involve contested or unverified claims, use cautious language ("reportedly", "according to public reporting") and prefer well-documented facts.
- lat/lng: coordinates of the capital or primary city of the person's country of residence/activity (WGS84).
- summary: 80-140 words, neutral, factual.
- suggestions: up to 6 real, living-or-recent people with the strongest documented political, financial or ideological relationships to this person. reason: one sentence explaining why they matter (close association, financial influence, political sway). Never list more than 6.
- companies: organizations/companies the person invested in, worked for, founded, or is documented to be indebted to/influenced by. Each with summary (1-2 sentences), role, timeline (e.g. "1998–2004").
- parties: political parties the person has belonged to, with summary (1-2 sentences), role, timeline.
- All fields are required; use [] for empty lists.`;

export async function resolvePerson(query: string): Promise<
  | { kind: "typo"; didYouMean: string }
  | { kind: "not_found" }
  | { kind: "person"; person: PersonPayload }
> {
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
    return { kind: "typo", didYouMean: parsed.didYouMean };
  }
  if (parsed.kind === "not_found") return { kind: "not_found" };
  const p = parsed.person as PersonPayload | undefined;
  if (!p || typeof p.name !== "string") throw new AIRequestError("AI returned a malformed profile.");
  return { kind: "person", person: normalizePerson(p) };
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
    companies: (Array.isArray(p.companies) ? p.companies : []).map((c) => ({
      name: String(c.name ?? ""),
      summary: String(c.summary ?? ""),
      role: String(c.role ?? ""),
      timeline: String(c.timeline ?? ""),
    })),
    parties: (Array.isArray(p.parties) ? p.parties : []).map((c) => ({
      name: String(c.name ?? ""),
      summary: String(c.summary ?? ""),
      role: String(c.role ?? ""),
      timeline: String(c.timeline ?? ""),
    })),
  };
}

const CONNECTION_SYSTEM = `You are the relationship-analysis engine of a geopolitical network-mapping website.
Output ONLY a single JSON object. Describe the documented relationship between two real people: how they know each other, where their stated interests coincide or conflict, and the nature of the tie (political, financial, ideological, familial, institutional).
Base it on verifiable public record; use cautious language for contested claims. 60-110 words.
Format: {"summary": "...", "tags": "political, financial"} — tags: 1-3 comma-separated lowercase categories from: political, financial, ideological, familial, institutional, diplomatic.`;

export async function describeConnection(
  a: { name: string; title: string },
  b: { name: string; title: string }
): Promise<{ summary: string; tags: string }> {
  const raw = await chat([
    { role: "system", content: CONNECTION_SYSTEM },
    {
      role: "user",
      content: `Describe the relationship between:\nA: ${a.name} — ${a.title}\nB: ${b.name} — ${b.title}`,
    },
  ]);
  const parsed = parseJsonObject<{ summary?: string; tags?: string }>(raw);
  return {
    summary: String(parsed.summary ?? ""),
    tags: String(parsed.tags ?? "political"),
  };
}
