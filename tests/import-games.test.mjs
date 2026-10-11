import test from "node:test";
import assert from "node:assert/strict";
import { validateGameImport } from "../lib/import-games.mjs";

const game = { igdbId: 119133, slug: "elden-ring", title: " Elden Ring " };

test("normalizes collector fields and discards unrelated data", () => {
  assert.deepEqual(validateGameImport([{ ...game, admin: true }]), [{
    igdbId: 119133, slug: "elden-ring", title: "Elden Ring",
    description: null, coverUrl: null, developer: null, publisher: null,
  }]);
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
