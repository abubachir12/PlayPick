import {
  integer,
  date,
  jsonb,
  real,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),

  igdbId: integer("igdb_id").unique(),
  rawgId: integer("rawg_id").unique(),
  steamId: integer("steam_id"),

  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),

  description: text("description"),
  coverUrl: text("cover_url"),

  developer: text("developer"),
  publisher: text("publisher"),
  releaseDate: date("release_date"),
  genres: jsonb("genres").$type<string[]>(),
  platforms: jsonb("platforms").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>(),
  rating: real("rating"),
  metacritic: integer("metacritic"),
  playtime: integer("playtime"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
