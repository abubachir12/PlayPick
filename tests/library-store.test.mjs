import test from "node:test";
import assert from "node:assert/strict";
import { clearList, emptyLibrary, hasGame, LIST_LIMIT, parseLibrary, toggleGame, toLibraryGame } from "../lib/library-store.mjs";

const game = (id, overrides = {}) => ({ id, slug: `game-${id}`, title: `Game ${id}`, coverUrl: null,
  releaseDate: "2020-01-01", genres: ["RPG"], rating: 4.2, ...overrides });

test("broken or foreign storage values become an empty library", () => {
  for (const raw of [null, "", "{", "null", "[]", "42", JSON.stringify({ favorites: "x" })]) {
    assert.deepEqual(parseLibrary(raw), emptyLibrary());
  }
});

test("stored games are trimmed to card fields, invalid and duplicate entries are dropped", () => {
  const raw = JSON.stringify({ favorites: [game(1, { description: "long", tags: ["x"] }), game(1), { id: 0, slug: "a", title: "A" },
    { id: 2, slug: "", title: "B" }, game(3, { genres: ["RPG", 5], rating: "5" })], played: null });
  const library = parseLibrary(raw);
  assert.deepEqual(library.favorites.map((item) => item.id), [1, 3]);
  assert.deepEqual(Object.keys(library.favorites[0]).sort(), ["coverUrl", "genres", "id", "rating", "releaseDate", "slug", "title"]);
  assert.deepEqual(library.favorites[1].genres, ["RPG"]);
  assert.equal(library.favorites[1].rating, null);
  assert.deepEqual(library.played, []);
});

test("toggle adds to the front, removes on the second call and never mutates", () => {
  const start = emptyLibrary();
  const one = toggleGame(start, "favorites", game(1));
  const two = toggleGame(one, "favorites", game(2));
  assert.deepEqual(start, emptyLibrary());
  assert.deepEqual(two.favorites.map((item) => item.id), [2, 1]);
  assert.ok(hasGame(two, "favorites", 1));
  assert.ok(!hasGame(two, "played", 1));
  const removed = toggleGame(two, "favorites", game(1));
  assert.deepEqual(removed.favorites.map((item) => item.id), [2]);
  assert.deepEqual(clearList(removed, "favorites").favorites, []);
  assert.throws(() => toggleGame(start, "wishlist", game(1)));
});

test("lists are capped so played IDs fit the recommendations excludeIds limit", () => {
  let library = emptyLibrary();
  for (let id = 1; id <= LIST_LIMIT + 5; id++) library = toggleGame(library, "played", game(id));
  assert.equal(library.played.length, LIST_LIMIT);
  assert.equal(library.played[0].id, LIST_LIMIT + 5);
  assert.equal(toLibraryGame(game(1, { id: 1.5 })), null);
});
