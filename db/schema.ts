import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),

  igdbId: integer("igdb_id").unique(),
  rawgId: integer("rawg_id"),
  steamId: integer("steam_id"),

  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),

  description: text("description"),
  coverUrl: text("cover_url"),

  developer: text("developer"),
  publisher: text("publisher"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});