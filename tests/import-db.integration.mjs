import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { validateGameImport } from "../lib/import-games.mjs";
import { createImportQuery } from "../lib/import-query.mjs";

dotenv.config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL);
// A session-local table shadows public.games only inside each transaction.
// No production rows or production sequences are changed.
const temporaryGames = sql`
  CREATE TEMP TABLE games (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    igdb_id integer UNIQUE, slug text UNIQUE NOT NULL, title text NOT NULL,
    description text, cover_url text, developer text, publisher text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  ) ON COMMIT DROP
`;
const initial = validateGameImport([{ igdbId: 1, slug: "test-game", title: "Test", description: "Keep" }]);

test("real SQL inserts and updates by IGDB ID, preserving links and missing fields", async () => {
  const updated = validateGameImport([{ igdbId: 1, slug: "renamed-game", title: "Updated" }]);
  const [, first, second, rows] = await sql.transaction([
    temporaryGames, createImportQuery(sql, initial), createImportQuery(sql, updated),
    sql`SELECT * FROM games`,
  ]);
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
    temporaryGames, createImportQuery(sql, initial), createImportQuery(sql, collision),
  ]), (error) => error.code === "23505");
});
