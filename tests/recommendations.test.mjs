import test from "node:test";
import assert from "node:assert/strict";
import { parseRecommendationPreferences as parse, rankRecommendations as rank,
  readRecommendationRequest as readRequest, recommendationOptions, RecommendationError } from "../lib/recommendations.mjs";

const game = (id, overrides = {}) => ({ id, title: `Game ${id}`, platforms: ["PC"], genres: [], tags: [], rating: null, ...overrides });
const post = (body, headers = { "content-type": "application/json" }) => new Request("http://localhost/api/recommendations", {
  method: "POST", headers, body,
});

test("preference defaults and normalized duplicate names and local IDs", () => {
  assert.deepEqual(parse({ mood: "story" }), { mood: "story", platform: null, preferredGenres: [], excludeIds: [],
    sessionMinutes: null, includeUnknownSession: true, limit: 6 });
  const p = parse({ mood: "story", platform: " PC ", preferredGenres: [" RPG ", "rpg"], excludeIds: [1, 1], sessionMinutes: 30 });
  assert.equal(p.platform, "PC");
  assert.equal(p.preferredGenres.length, 1);
  assert.deepEqual(p.excludeIds, [1]);
});

test("invalid types, unknown keys, unsupported moods and bounds are rejected", () => {
  for (const input of [null, [], "story", {}, { mood: "__proto__" }, { mood: "constructor" }, { mood: "happy" },
    { mood: "story", admin: true }, ...[
      { platform: null }, { platform: " " }, { preferredGenres: "RPG" }, { preferredGenres: [null] },
      { preferredGenres: Array(6).fill("RPG") }, { excludeIds: [0] }, { excludeIds: ["1"] },
      { excludeIds: Array(101).fill(1) }, { limit: 0 }, { limit: 21 }, { limit: "6" }, { limit: 1.5 },
      { sessionMinutes: 4 }, { sessionMinutes: 241 }, { sessionMinutes: null }, { sessionMinutes: "30" },
      { sessionMinutes: 30, includeUnknownSession: "false" }, { includeUnknownSession: false },
    ].map((p) => ({ mood: "story", ...p }))]) {
    assert.throws(() => parse(input), RecommendationError);
  }
});

test("reader accepts JSON charset, rejects malformed or non-object JSON and unsupported media types", async () => {
  assert.equal((await readRequest(post('{"mood":"story"}', { "content-type": "Application/JSON; charset=utf-8" }))).mood, "story");
  for (const body of ["", "{", "[]", "null", '{"mood":"story","limit":NaN}']) {
    await assert.rejects(readRequest(post(body)), (error) => error.status === 400);
  }
  await assert.rejects(readRequest(post("{}", {})), (error) => error.status === 415);
  await assert.rejects(readRequest(post("{}", { "content-type": "text/plain" })), (error) => error.status === 415);
  await assert.rejects(readRequest(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" } })), /отсутствует/);
  await assert.rejects(readRequest(post(new Uint8Array([0xff, 0xfe]))), /JSON/);
});

test("body limit is enforced with or without Content-Length and counts UTF-8 bytes", async () => {
  const error413 = (error) => error instanceof RecommendationError && error.status === 413;
  await assert.rejects(readRequest(post("{}", { "content-type": "application/json", "content-length": "9000" })), error413);
  await assert.rejects(readRequest(post(JSON.stringify({ mood: "story", extra: "я".repeat(5000) }))), error413);
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(4096)); }, cancel() { cancelled = true; } });
  const request = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: stream, duplex: "half" });
  await assert.rejects(readRequest(request), error413);
  assert.equal(cancelled, true);
});

test("each mood needs matching evidence; rating and preference alone cannot qualify", () => {
  const cases = { relax: { genres: ["Puzzle"] }, challenge: { tags: ["Difficult"] },
    story: { tags: ["Story Rich"] }, explore: { tags: ["Exploration"] }, social: { tags: ["Co-op"] } };
  for (const [mood, metadata] of Object.entries(cases)) {
    const result = rank([game(1, { rating: 5, genres: ["Sports"] }), game(2, metadata)], parse({ mood, preferredGenres: ["Sports"] }));
    assert.deepEqual(result.items.map((item) => item.game.id), [2], mood);
    assert.ok(result.items[0].reasons.some((r) => r.code.startsWith("mood-")));
  }
});

test("relax blocks known difficult, competitive and horror evidence even with relaxing metadata", () => {
  const games = [game(1, { genres: ["Puzzle"], tags: ["Relaxing"] }),
    ...["Horror", "Difficult", "Souls-like", "Competitive"].map((tag, i) => game(i + 2, { genres: ["Puzzle"], tags: [tag, "Relaxing"] })),
    game(9, { genres: ["Puzzle", "Horror"] })];
  assert.deepEqual(rank(games, parse({ mood: "relax" })).items.map((item) => item.game.id), [1]);
});

test("platform and excluded local IDs are hard filters and cannot be relaxed to fill a page", () => {
  const games = [game(1, { tags: ["Story Rich"], rawgId: 999 }),
    game(2, { tags: ["Story Rich"], platforms: ["PlayStation 5"] }),
    game(3, { tags: ["Story Rich"], platforms: null })];
  const result = rank(games, parse({ mood: "story", platform: " pc ", excludeIds: [1] }));
  assert.deepEqual(result.items, []);
  assert.equal(result.meta.eligibleCount, 0);
  assert.ok(result.meta.warnings.some((warning) => warning.code === "no-matches"));
  assert.equal(rank(games, parse({ mood: "story", platform: "PC", excludeIds: [999] })).items[0].game.id, 1);
});

test("preferred genres increase rank without excluding other genres, case-insensitively", () => {
  const games = [game(1, { tags: ["Story Rich"], genres: ["Shooter"] }), game(2, { tags: ["Story Rich"], genres: ["Puzzle"] })];
  const result = rank(games, parse({ mood: "story", preferredGenres: ["puzzle"] }));
  assert.deepEqual(result.items.map((item) => item.game.id), [2, 1]);
  assert.ok(result.items[0].reasons.some((r) => r.code === "preferred-genre"));
});

test("null metadata is safe; results are deterministic, bounded, and do not mutate input", () => {
  const games = [game(3, { tags: null, genres: null, platforms: null }),
    game(2, { tags: ["story rich"], rating: 5 }), game(1, { tags: ["Story Rich"], rating: 5 })];
  const copy = structuredClone(games);
  const preferences = parse({ mood: "story", limit: 1 });
  const first = rank(games, preferences);
  assert.deepEqual(first.items.map((item) => item.game.id), [1]);
  assert.equal(first.meta.eligibleCount, 2);
  assert.equal(first.meta.returnedCount, 1);
  assert.deepEqual(rank([...games].reverse(), preferences), first);
  assert.deepEqual(games, copy);
  assert.ok(first.items.every((item) => Number.isInteger(item.score) && item.score > 0 && item.score <= 100));
});

test("unknown session lengths are explicit and RAWG playtime never substitutes for session duration", () => {
  const games = [game(1, { tags: ["Co-op"], playtime: 1 }), game(2, { tags: ["Co-op"], playtime: 999 })];
  const result = rank(games, parse({ mood: "social", sessionMinutes: 30 }));
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((item) => item.sessionFit.status === "unknown" && item.sessionFit.minimumMinutes === null));
  assert.equal(result.items[0].score, result.items[1].score);
  assert.equal(result.meta.session.unknownIncluded, 2);
  const strict = rank(games, parse({ mood: "social", sessionMinutes: 30, includeUnknownSession: false }));
  assert.deepEqual(strict.items, []);
  assert.equal(strict.meta.session.unknownExcluded, 2);
});

test("verified editorial session profiles apply only by RAWG ID and exclude insufficient budgets", () => {
  const games = [game(1, { rawgId: 3272, tags: ["Co-op"] }), game(3272, { tags: ["Co-op"], playtime: 1 })];
  const enough = rank(games, parse({ mood: "social", sessionMinutes: 15, includeUnknownSession: false }));
  assert.deepEqual(enough.items.map((item) => item.game.id), [1]);
  assert.equal(enough.items[0].sessionFit.status, "estimated-fit");
  assert.equal(enough.items[0].sessionFit.minimumMinutes, 15);
  assert.equal(enough.items[0].sessionFit.basis, "editorial");
  assert.ok(enough.items[0].sessionFit.sourceUrl.startsWith("https://www.rocketleague.com/"));
  assert.deepEqual(rank(games, parse({ mood: "social", sessionMinutes: 5, includeUnknownSession: false })).items, []);
  assert.equal(rank(games, parse({ mood: "social" })).items[0].sessionFit.status, "not-requested");
});

test("options expose all supported moods and actual request bounds", () => {
  const options = recommendationOptions();
  assert.deepEqual(options.moods.map((mood) => mood.id), ["relax", "challenge", "story", "explore", "social"]);
  for (const mood of options.moods) assert.doesNotThrow(() => parse({ mood: mood.id }));
  assert.equal(options.sessionMinutes.min, 5);
  assert.equal(options.limit.max, 20);
});
