export * from "./errors";

// ── Shared domain types (frontend ↔ backend) ──────────────────────────────

export type SuggestionDto = {
  name: string;
  reason: string;
  status: "pending" | "added";
};

export type CompanyDto = {
  name: string;
  summary: string;
  role: string;
  timeline: string;
};

export type PartyDto = {
  name: string;
  summary: string;
  role: string;
  timeline: string;
};

export type PersonDto = {
  id: number;
  worldId: number;
  name: string;
  title: string;
  country: string;
  lat: number;
  lng: number;
  summary: string;
  suggestions: SuggestionDto[];
  companies: CompanyDto[];
  parties: PartyDto[];
  createdAt: string | Date;
};

export type ConnectionDto = {
  id: number;
  worldId: number;
  personAId: number;
  personBId: number;
  summary: string;
  tags: string;
  createdAt: string | Date;
};

export type WorldDto = {
  id: number;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type WorldDetailDto = {
  world: WorldDto;
  persons: PersonDto[];
  connections: ConnectionDto[];
};

// Result of the AI-powered search flow
export type SearchResultDto =
  | { type: "typo"; didYouMean: string; original: string }
  | { type: "not_found"; message: string }
  | { type: "duplicate"; person: PersonDto }
  | {
      type: "added";
      person: PersonDto;
      newConnections: ConnectionDto[];
      /** Number of connection summaries being generated in the background. */
      pendingLinks?: number;
    };
