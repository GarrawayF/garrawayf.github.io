import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

import type { Worksheet } from "../app/worksheet";

const worksheetColumn = (name: string) => text(name, { mode: "json" }).$type<Worksheet>().notNull().default({});
const roomColumn = () => text("room", { enum: ["event", "demo"] }).notNull().default("event");

export const ideas = sqliteTable("ideas", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  room: roomColumn(),
  team: text("team", { enum: ["A", "B", "C", "D", "E"] }).notNull(),
  round: integer("round").notNull(),
  text: text("idea_text").notNull(),
  worksheet: worksheetColumn("worksheet"),
  context: text("context").notNull().default(""),
  name: text("display_name").notNull().default(""),
  parentId: text("parent_id").references((): AnySQLiteColumn => ideas.id),
  createdAt: text("created_at").notNull(),
}, (table) => [index("ideas_room_sequence").on(table.room, table.sequence)]);

export const teamThemes = sqliteTable("team_themes", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  room: roomColumn(),
  team: text("team", { enum: ["A", "B", "C", "D", "E", "all"] }).notNull(),
  round: integer("round").notNull(),
  text: text("theme_text").notNull(),
  initialText: text("initial_text").notNull(),
  worksheet: worksheetColumn("worksheet"),
  initialWorksheet: worksheetColumn("initial_worksheet"),
  sourceIdeaId: text("source_idea_id").references(() => ideas.id),
  sourceIdeaId2: text("source_idea_id_2").references(() => ideas.id),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("team_themes_room_sequence").on(table.room, table.sequence)]);

export const reactions = sqliteTable("reactions", {
  ideaId: text("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  themeId: text("theme_id").references(() => teamThemes.id, { onDelete: "cascade" }),
  actorHash: text("actor_hash").notNull(),
  kind: text("kind", { enum: ["like", "love"] }).notNull(),
}, (table) => [
  check("reaction_has_one_target", sql`(${table.ideaId} is null) <> (${table.themeId} is null)`),
  check("reaction_kind", sql`${table.kind} in ('like', 'love')`),
  uniqueIndex("reaction_per_idea").on(table.ideaId, table.kind, table.actorHash),
  uniqueIndex("reaction_per_theme").on(table.themeId, table.kind, table.actorHash),
]);

export const comments = sqliteTable("comments", {
  sequence: integer("sequence").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  ideaId: text("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  themeId: text("theme_id").references(() => teamThemes.id, { onDelete: "cascade" }),
  text: text("comment_text").notNull(),
  name: text("display_name").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  check("comment_has_one_target", sql`(${table.ideaId} is null) <> (${table.themeId} is null)`),
  index("comments_by_idea").on(table.ideaId),
  index("comments_by_theme").on(table.themeId),
]);
