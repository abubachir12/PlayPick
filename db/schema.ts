import {
  integer,
  date,
  index,
  jsonb,
  primaryKey,
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
  steamId: integer("steam_id").unique(),

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

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Stored lower-cased and trimmed; uniqueness is enforced on the normalized value.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // scrypt$N$r$p$salt$hash — never the password itself.
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the random cookie token: a leaked table does not reveal live sessions.
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);

export const userGames = pgTable("user_games", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  // "favorites" or "played", the same lists the browser library keeps.
  list: text("list").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.gameId, table.list] })]);
