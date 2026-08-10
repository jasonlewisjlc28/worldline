import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  double,
  json,
} from "drizzle-orm/mysql-core";

export const worlds = mysqlTable("worlds", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type Suggestion = {
  name: string;
  reason: string;
  status: "pending" | "added";
};

export type CompanyInvolvement = {
  name: string;
  summary: string;
  role: string;
  timeline: string;
};

export type PartyMembership = {
  name: string;
  summary: string;
  role: string;
  timeline: string;
};

export const persons = mysqlTable("persons", {
  id: serial("id").primaryKey(),
  worldId: bigint("world_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => worlds.id),
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull().default(""),
  country: varchar("country", { length: 255 }).notNull().default(""),
  lat: double("lat").notNull().default(0),
  lng: double("lng").notNull().default(0),
  summary: text("summary"),
  suggestions: json("suggestions").$type<Suggestion[]>(),
  companies: json("companies").$type<CompanyInvolvement[]>(),
  parties: json("parties").$type<PartyMembership[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Alignment = {
  strategic: number;
  financial: number;
  trust: number;
  ideological: number;
  overall: number;
  reasons: { strategic: string; financial: string; trust: string; ideological: string };
};

export const connections = mysqlTable("connections", {
  id: serial("id").primaryKey(),
  worldId: bigint("world_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => worlds.id),
  personAId: bigint("person_a_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => persons.id),
  personBId: bigint("person_b_id", { mode: "number", unsigned: true })
    .notNull()
    .references(() => persons.id),
  summary: text("summary"),
  tags: varchar("tags", { length: 255 }).notNull().default(""),
  alignment: json("alignment").$type<Alignment>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
