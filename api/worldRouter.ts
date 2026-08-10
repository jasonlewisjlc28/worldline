import { z } from "zod";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { connections, persons, worlds } from "../db/schema";
import { AIRequestError, AIUnavailableError, analyzeCompanyAffiliation, describeConnection, resolvePerson } from "./ai";
import { TRPCError } from "@trpc/server";
import type {
  ConnectionDto,
  PersonDto,
  SearchResultDto,
  WorldDetailDto,
} from "../contracts/types";

function toPersonDto(p: typeof persons.$inferSelect): PersonDto {
  return {
    id: p.id,
    worldId: p.worldId,
    name: p.name,
    title: p.title,
    country: p.country,
    lat: p.lat,
    lng: p.lng,
    summary: p.summary ?? "",
    suggestions: p.suggestions ?? [],
    companies: p.companies ?? [],
    parties: p.parties ?? [],
    createdAt: p.createdAt,
  };
}

function toConnectionDto(c: typeof connections.$inferSelect): ConnectionDto {
  return {
    id: c.id,
    worldId: c.worldId,
    personAId: c.personAId,
    personBId: c.personBId,
    summary: c.summary ?? "",
    tags: c.tags,
    createdAt: c.createdAt,
  };
}

async function getWorldDetail(worldId: number): Promise<WorldDetailDto> {
  const db = getDb();
  const world = await db.query.worlds.findFirst({ where: eq(worlds.id, worldId) });
  if (!world) throw new TRPCError({ code: "NOT_FOUND", message: "World not found" });
  const ps = await db.query.persons.findMany({
    where: eq(persons.worldId, worldId),
    orderBy: [asc(persons.id)],
  });
  const cs = await db.query.connections.findMany({
    where: eq(connections.worldId, worldId),
    orderBy: [asc(connections.id)],
  });

  // Never surface a suggestion that points to someone already on the map.
  const takenNames = new Set(ps.map((p) => p.name.toLowerCase()));
  const personsOut = ps.map((p) => {
    const dto = toPersonDto(p);
    dto.suggestions = dto.suggestions.filter(
      (s) => !takenNames.has(s.name.toLowerCase()) || s.status === "added"
    );
    return dto;
  });

  return { world, persons: personsOut, connections: cs.map(toConnectionDto) };
}

function aiErrorToTrpc(e: unknown): never {
  if (e instanceof AIUnavailableError) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
  }
  if (e instanceof AIRequestError) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
  }
  throw e;
}

async function insertPerson(
  worldId: number,
  payload: {
    name: string;
    title: string;
    country: string;
    lat: number;
    lng: number;
    summary: string;
    suggestions: { name: string; reason: string }[];
    companies: { name: string; summary: string; role: string; timeline: string }[];
    parties: { name: string; summary: string; role: string; timeline: string }[];
  }
): Promise<PersonDto> {
  const db = getDb();
  const [result] = await db.insert(persons).values({
    worldId,
    name: payload.name,
    title: payload.title,
    country: payload.country,
    lat: payload.lat,
    lng: payload.lng,
    summary: payload.summary,
    suggestions: payload.suggestions.map((s) => ({ ...s, status: "pending" as const })),
    companies: payload.companies,
    parties: payload.parties,
  });
  const created = await db.query.persons.findFirst({
    where: eq(persons.id, Number(result.insertId)),
  });
  if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  return toPersonDto(created);
}

/**
 * Create AI-described connections between a new person and every existing person.
 * Runs IN THE BACKGROUND — the HTTP request returns immediately after the person
 * is inserted, and the frontend polls world.detail for new connections. This keeps
 * requests short enough to avoid platform gateway timeouts (HTML error pages).
 */
function linkToExistingInBackground(worldId: number, newcomer: PersonDto): void {
  const db = getDb();
  void (async () => {
    const others = await db.query.persons.findMany({
      where: eq(persons.worldId, worldId),
    });
    for (const other of others) {
      if (other.id === newcomer.id) continue;
      try {
        const rel = await describeConnection(
          { name: newcomer.name, title: newcomer.title },
          { name: other.name, title: other.title }
        );
        // No documented direct tie → don't create the connection at all
        // (also saves further processing on that pair).
        if (!rel.direct) continue;
        await db.insert(connections).values({
          worldId,
          personAId: Math.min(newcomer.id, other.id),
          personBId: Math.max(newcomer.id, other.id),
          summary: rel.summary,
          tags: rel.tags,
        });
      } catch (e) {
        // A single failed link shouldn't block the rest; AIUnavailable surfaces on next action.
        console.error(`[link] ${newcomer.name} ↔ ${other.name} failed:`, e);
      }
    }
  })().catch((e) => console.error("[link] background linking crashed:", e));
}

/** How many people the newcomer still needs links to (for frontend polling). */
async function pendingLinkCount(worldId: number, newcomerId: number): Promise<number> {
  const db = getDb();
  const others = await db.query.persons.findMany({
    where: eq(persons.worldId, worldId),
  });
  return others.filter((p) => p.id !== newcomerId).length;
}

async function markSuggestionAdded(personId: number, suggestedName: string) {
  const db = getDb();
  const person = await db.query.persons.findFirst({ where: eq(persons.id, personId) });
  if (!person?.suggestions) return;
  const updated = person.suggestions.map((s) =>
    s.name.toLowerCase() === suggestedName.toLowerCase()
      ? { ...s, status: "added" as const }
      : s
  );
  await db.update(persons).set({ suggestions: updated }).where(eq(persons.id, personId));
}

async function runAddFlow(worldId: number, query: string): Promise<SearchResultDto> {
  const db = getDb();
  let resolved;
  try {
    resolved = await resolvePerson(query);
  } catch (e) {
    aiErrorToTrpc(e);
  }
  if (resolved.kind === "typo") {
    return { type: "typo", didYouMean: resolved.didYouMean, original: query };
  }
  if (resolved.kind === "not_found") {
    return {
      type: "not_found",
      message: `No identifiable public figure found for "${query}".`,
    };
  }
  const payload = resolved.person;

  // Duplicate check (case-insensitive name match within the world)
  const existing = await db.query.persons.findMany({ where: eq(persons.worldId, worldId) });
  const dupe = existing.find((p) => p.name.toLowerCase() === payload.name.toLowerCase());
  if (dupe) return { type: "duplicate", person: toPersonDto(dupe) };

  const person = await insertPerson(worldId, payload);
  const pendingLinks = await pendingLinkCount(worldId, person.id);
  linkToExistingInBackground(worldId, person);

  // Strip suggestions that name people already on the map — both from the
  // DB record and the response, so the People tab never offers them again.
  const allNow = await db.query.persons.findMany({ where: eq(persons.worldId, worldId) });
  const takenNames = new Set(allNow.map((p) => p.name.toLowerCase()));
  const filtered = person.suggestions.filter((s) => !takenNames.has(s.name.toLowerCase()));
  if (filtered.length !== person.suggestions.length) {
    await db.update(persons).set({ suggestions: filtered }).where(eq(persons.id, person.id));
    person.suggestions = filtered;
  }

  return { type: "added", person, newConnections: [], pendingLinks };
}

export const worldRouter = createRouter({
  status: publicQuery.query(() => ({
    aiReady: Boolean(process.env.AI_API_KEY?.trim()),
  })),

  list: publicQuery.query(async () => {
    const db = getDb();
    return db.query.worlds.findMany({ orderBy: [desc(worlds.updatedAt)] });
  }),

  deleteWorld: publicQuery
    .input(z.object({ worldId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(connections).where(eq(connections.worldId, input.worldId));
      await db.delete(persons).where(eq(persons.worldId, input.worldId));
      await db.delete(worlds).where(eq(worlds.id, input.worldId));
      return { ok: true };
    }),

  create: publicQuery
    .input(z.object({ name: z.string().min(1).max(255) })).mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(worlds).values({ name: input.name });
      return db.query.worlds.findFirst({ where: eq(worlds.id, Number(result.insertId)) });
    }),

  detail: publicQuery
    .input(z.object({ worldId: z.number() }))
    .query(({ input }) => getWorldDetail(input.worldId)),

  /** Search for a person and add them to the world (with typo / not-found / duplicate handling). */
  searchAndAdd: publicQuery
    .input(z.object({ worldId: z.number(), query: z.string().min(1).max(200) }))
    .mutation(({ input }) => runAddFlow(input.worldId, input.query)),

  /** Confirm a "did you mean" correction and proceed with the add. */
  confirmAdd: publicQuery
    .input(z.object({ worldId: z.number(), name: z.string().min(1).max(200) }))
    .mutation(({ input }) => runAddFlow(input.worldId, input.name)),

  /** Add one of a person's pending suggestions. */
  addSuggestion: publicQuery
    .input(z.object({ worldId: z.number(), personId: z.number(), suggestionName: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await runAddFlow(input.worldId, input.suggestionName);

      // The added/duplicate person gets linked back to the person whose list
      // they came from — this is the tie the user explicitly requested.
      if (result.type === "added" || result.type === "duplicate") {
        await markSuggestionAdded(input.personId, input.suggestionName);

        const addedId = result.person.id;
        const sourceId = input.personId;
        if (addedId !== sourceId) {
          const pairA = Math.min(addedId, sourceId);
          const pairB = Math.max(addedId, sourceId);
          const existing = await db.query.connections.findFirst({
            where: and(
              eq(connections.worldId, input.worldId),
              eq(connections.personAId, pairA),
              eq(connections.personBId, pairB)
            ),
          });
          if (!existing) {
            const [src, dst] = await Promise.all([
              db.query.persons.findFirst({ where: eq(persons.id, sourceId) }),
              db.query.persons.findFirst({ where: eq(persons.id, addedId) }),
            ]);
            if (src && dst) {
              const rel = await describeConnection(
                { name: src.name, title: src.title },
                { name: dst.name, title: dst.title }
              ).catch(() => ({ direct: false, strength: 0, summary: "", tags: "political" }));
              if (rel.direct) {
                const [ins] = await db.insert(connections).values({
                  worldId: input.worldId,
                  personAId: pairA,
                  personBId: pairB,
                  summary: rel.summary,
                  tags: rel.tags,
                });
                const created = await db.query.connections.findFirst({
                  where: eq(connections.id, Number(ins.insertId)),
                });
                if (created && result.type === "added") {
                  result.newConnections = [...result.newConnections, toConnectionDto(created)];
                }
              }
            }
          }
        }
      }
      return result;
    }),

  removePerson: publicQuery
    .input(z.object({ worldId: z.number(), personId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .delete(connections)
        .where(
          and(
            eq(connections.worldId, input.worldId),
            or(
              eq(connections.personAId, input.personId),
              eq(connections.personBId, input.personId)
            )
          )
        );
      await db.delete(persons).where(eq(persons.id, input.personId));
      return { ok: true };
    }),

  createConnection: publicQuery
    .input(
      z.object({
        worldId: z.number(),
        personAId: z.number(),
        personBId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.personAId === input.personBId)
        throw new Error("Choose two different people.");
      const db = getDb();
      const pairA = Math.min(input.personAId, input.personBId);
      const pairB = Math.max(input.personAId, input.personBId);
      const existing = await db.query.connections.findFirst({
        where: and(
          eq(connections.worldId, input.worldId),
          eq(connections.personAId, pairA),
          eq(connections.personBId, pairB)
        ),
      });
      if (existing) return { connection: existing, alreadyExisted: true };
      const [pa, pb] = await Promise.all([
        db.query.persons.findFirst({
          where: and(eq(persons.id, pairA), eq(persons.worldId, input.worldId)),
        }),
        db.query.persons.findFirst({
          where: and(eq(persons.id, pairB), eq(persons.worldId, input.worldId)),
        }),
      ]);
      if (!pa || !pb) throw new Error("Both people must be on this map.");
      const rel = await describeConnection(
        { name: pa.name, title: pa.title ?? "" },
        { name: pb.name, title: pb.title ?? "" }
      );
      if (!rel.direct) {
        throw new Error(
          `No documented direct connection found between ${pa.name} and ${pb.name} — no tie was created.`
        );
      }
      await db.insert(connections).values({
        worldId: input.worldId,
        personAId: pairA,
        personBId: pairB,
        summary: rel.summary,
        tags: rel.tags,
      });
      const created = await db.query.connections.findFirst({
        where: and(
          eq(connections.worldId, input.worldId),
          eq(connections.personAId, pairA),
          eq(connections.personBId, pairB)
        ),
      });
      return { connection: created, alreadyExisted: false };
    }),

  analyzeCompany: publicQuery
    .input(
      z.object({
        worldId: z.number(),
        personId: z.number(),
        companyName: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const person = await db.query.persons.findFirst({
        where: and(eq(persons.id, input.personId), eq(persons.worldId, input.worldId)),
      });
      if (!person) throw new Error("Person not found.");
      const target = input.companyName.trim().toLowerCase();
      const entry = ((person.companies as any[]) ?? []).find(
        (c) => c?.name && String(c.name).trim().toLowerCase() === target
      );
      const analysis = await analyzeCompanyAffiliation(
        { name: person.name, title: person.title ?? "" },
        input.companyName,
        {
          role: String(entry?.role ?? ""),
          timeline: String(entry?.timeline ?? ""),
          summary: String(entry?.summary ?? ""),
        }
      );
      if (!analysis) throw new AIRequestError("The AI returned an empty analysis.");
      return { analysis };
    }),
});
