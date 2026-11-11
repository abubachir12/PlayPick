import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { validateGameImport } from "../lib/import-games.mjs";
import { createImportQuery } from "../lib/import-query.mjs";
import { readFile } from "node:fs/promises";

dotenv.config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL);
// A session-local table shadows public.games only inside each transaction.
// No production rows or production sequences are changed.
const temporaryGames = sql`
  CREATE TEMP TABLE games (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id integer UNIQUE, rawg_id integer, slug text UNIQUE NOT NULL, title text NOT NULL,
    description text, cover_url text, developer text, publisher text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  ) ON COMMIT DROP
`;
// Exercise the actual additive migration against an isolated pre-migration table.
const migration = await readFile(new URL("../drizzle/0001_rawg_catalog.sql", import.meta.url), "utf8");
const setup = () => [temporaryGames, ...migration.split("--> statement-breakpoint")
  .filter((statement) => statement.trim()).map((statement) => sql.query(statement))];
const initial = validateGameImport([{ igdbId: 1, slug: "test-game", title: "Test", description: "Keep" }]);

test("real SQL inserts and updates by IGDB ID, preserving links and missing fields", async () => {
  const updated = validateGameImport([{ igdbId: 1, slug: "renamed-game", title: "Updated" }]);
  const results = await sql.transaction([
    ...setup(), createImportQuery(sql, initial), createImportQuery(sql, updated),
    sql`SELECT * FROM games`,
  ]);
  const [first, second, rows] = results.slice(-3);
  assert.equal(rows.length, 1);
  assert.equal(first[0].id, second[0].id);
  assert.equal(rows[0].slug, "test-game");
  assert.equal(rows[0].title, "Updated");
  assert.equal(rows[0].description, "Keep");
});

test("slug collision rejects the whole batch", async () => {
  const collision = validateGameImport([
    { igdbId: 2, slug: "second-game", title: "Second" },
    { igdbId: 3, slug: "test-game", title: "Collision" },
  ]);
  await assert.rejects(sql.transaction([
    ...setup(), createImportQuery(sql, initial), createImportQuery(sql, collision),
  ]), (error) => error.code === "23505");
});

test("RAWG reimport preserves local IDs, slugs and nullable metadata; zero and arrays update", async () => {
  const original = validateGameImport([{ rawgId: 99, slug: "rawg-game", title: "Original",
    description: "Keep", releaseDate: "2024-02-29", genres: ["RPG"], rating: 4, playtime: 20 }]);
  const update = validateGameImport([{ rawgId: 99, slug: "new-rawg-slug", title: "Updated",
    genres: [], rating: 0, playtime: 0 }]);
  const result = await sql.transaction([...setup(), createImportQuery(sql, original),
    createImportQuery(sql, update), sql`SELECT *, release_date::text AS release_date FROM games`]);
  const [first, second, rows] = result.slice(-3);
  assert.equal(first[0].id, second[0].id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].slug, "rawg-game");
  assert.equal(rows[0].title, "Updated");
  assert.equal(rows[0].description, "Keep");
  assert.equal(rows[0].release_date, "2024-02-29");
  assert.deepEqual(rows[0].genres, []);
  assert.equal(rows[0].rating, 0);
  assert.equal(rows[0].playtime, 0);
});

test("identical RAWG and IGDB numeric IDs are separate games", async () => {
  const rawg = validateGameImport([{ rawgId: 1, slug: "rawg-one", title: "RAWG" }]);
  const result = await sql.transaction([...setup(), createImportQuery(sql, initial),
    createImportQuery(sql, rawg), sql`SELECT * FROM games`]);
  assert.equal(result.at(-1).length, 2);
});

test("RAWG never silently links a manual record by slug", async () => {
  const rawg = validateGameImport([{ rawgId: 2, slug: "manual-game", title: "RAWG" }]);
  await assert.rejects(sql.transaction([...setup(),
    sql`INSERT INTO games (slug,title) VALUES ('manual-game','Manual')`,
    createImportQuery(sql, rawg)]), (error) => error.code === "23505");
});
