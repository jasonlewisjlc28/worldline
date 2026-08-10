import { z } from "zod";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { connections, persons, worlds } from "../db/schema";
import { AIRequestError, AIUnavailableError, describeConnection, resolvePerson } from "./ai";
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
  return { world, persons: ps.map(toPersonDto), connections: cs.map(toConnectionDto) };
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

  create: publicQuery
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
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
      const result = await runAddFlow(input.worldId, input.suggestionName);
      if (result.type === "added" || result.type === "duplicate") {
        await markSuggestionAdded(input.personId, input.suggestionName);
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
});
