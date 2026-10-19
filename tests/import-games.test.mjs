import test from "node:test";
import assert from "node:assert/strict";
import { validateGameImport } from "../lib/import-games.mjs";

const game = { igdbId: 119133, slug: "elden-ring", title: " Elden Ring " };

test("normalizes collector fields and discards unrelated data", () => {
  assert.deepEqual(validateGameImport([{ ...game, admin: true }]), [{
    igdbId: 119133, slug: "elden-ring", title: "Elden Ring",
    description: null, coverUrl: null, developer: null, publisher: null,
    releaseDate: null, genres: null, platforms: null, tags: null,
    rating: null, metacritic: null, playtime: null,
  }]);
});

test("RAWG metadata is validated and external ID namespaces cannot be mixed", () => {
  const rawg = { rawgId: 42, slug: "game_42", title: "Game", releaseDate: "2024-02-29",
    genres: [" RPG ", "RPG"], rating: 4.5, metacritic: 0, playtime: 0 };
  const [record] = validateGameImport([rawg]);
  assert.deepEqual(record.genres, ["RPG"]);
  assert.equal(record.playtime, 0);
  assert.equal(record.igdbId, undefined);
  for (const item of [{ ...rawg, igdbId: 1 }, { ...rawg, rawgId: null },
    { ...rawg, releaseDate: "2023-02-29" }, { ...rawg, releaseDate: "2024-02-31" },
    { ...rawg, rating: 5.1 }, { ...rawg, rating: NaN }, { ...rawg, metacritic: 101 },
    { ...rawg, playtime: -1 }, { ...rawg, genres: [""] }, { ...rawg, tags: "RPG" }]) {
    assert.throws(() => validateGameImport([item]));
  }
  assert.throws(() => validateGameImport([game, rawg]));
});

test("rejects invalid batches before connecting to the database", () => {
  for (const input of [[], {}, [null], Array(101).fill(game), [game, game],
    [{ ...game, igdbId: -1 }], [{ ...game, igdbId: 2147483648 }],
    [{ ...game, slug: "../elden-ring" }], [{ ...game, title: " " }],
    [{ ...game, coverUrl: "http://example.com/cover.png" }],
    [{ ...game, coverUrl: "https://user:secret@example.com/cover.png" }]]) {
    assert.throws(() => validateGameImport(input));
  }
});
