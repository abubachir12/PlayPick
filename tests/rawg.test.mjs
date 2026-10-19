import test from "node:test";
import assert from "node:assert/strict";
import { createRawgClient, normalizeRawgGame, parseRawgArgs, RawgError } from "../lib/rawg.mjs";

const game = { id: 42, name: "Game", slug: "game_42", description_raw: "Plain description",
  description: "<script>bad</script>", background_image: "https://media.rawg.io/media/games/test.jpg",
  released: "2024-02-29", rating: 4.5, metacritic: 90, playtime: 12,
  developers: [{ name: "Dev" }], publishers: [{ name: "Publisher" }],
  genres: [{ name: "RPG" }], tags: [{ name: "Singleplayer" }], platforms: [{ platform: { name: "PC" } }] };
const response = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const noWait = async () => {};

test("RAWG details map into the catalog without copying HTML or external ID namespaces", () => {
  const value = normalizeRawgGame(game);
  assert.equal(value.rawgId, 42);
  assert.equal(value.igdbId, undefined);
  assert.equal(value.description, "Plain description");
  assert.equal(value.developer, "Dev");
  assert.deepEqual(value.platforms, ["PC"]);
  assert.deepEqual(value.genres, ["RPG"]);
  assert.equal(normalizeRawgGame({ id: 1, name: "Minimal", slug: "minimal" }).coverUrl, null);
  assert.equal(normalizeRawgGame({ ...game, description_raw: undefined }).description, null);
});

test("rejects malformed metadata and untrusted image URLs", () => {
  for (const item of [null, {}, { ...game, id: -1 }, { ...game, released: "2023-02-29" },
    { ...game, developers: "wrong" }, { ...game, platforms: [{}] }, { ...game, genres: [{ name: "" }] },
    ...["http://media.rawg.io/a", "https://media.rawg.io.attacker.com/a", "https://user:secret@media.rawg.io/a",
      "https://media.rawg.io:444/a"].map((background_image) => ({ ...game, background_image }))]) {
    assert.throws(() => normalizeRawgGame(item), RawgError);
  }
});

test("CLI bounds options, rejects ambiguous or missing values", () => {
  assert.deepEqual(parseRawgArgs(["data/games.json"]), { output: "data/games.json", limit: 10, page: 1, search: "" });
  assert.equal(parseRawgArgs(["a.json", "--search", " Elden Ring ", "--limit", "40", "--page", "2"]).search, "Elden Ring");
  for (const args of [[], ["a.txt"], ["a.json", "b.json"], ["a.json", "--offset", "1"],
    ["a.json", "--limit", "41"], ["a.json", "--page", "0"], ["a.json", "--limit", "1e1"],
    ["a.json", "--page"], ["a.json", "--search", "--limit", "1"], ["a.json", "--search", " "],
    ["a.json", "--limit", "1", "--limit", "2"]]) assert.throws(() => parseRawgArgs(args), RawgError);
});

test("fetches bounded list then details, never follows upstream pagination URLs", async () => {
  const calls = [];
  const client = createRawgClient({ apiKey: "test-secret", wait: noWait, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? response({ results: [{ id: 42 }], next: "https://attacker.example/?key=secret" }) : response(game);
  } });
  const result = await client.getGames({ limit: 2, page: 3, search: "Elden & Ring" });
  assert.equal(result[0].rawgId, 42);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("search"), "Elden & Ring");
  assert.equal(calls[0].url.searchParams.get("page_size"), "2");
  assert.equal(calls[0].url.searchParams.get("page"), "3");
  assert.equal(calls[0].url.searchParams.get("search_precise"), "true");
  assert.equal(calls[0].url.searchParams.has("ordering"), false);
  assert.equal(calls[1].url.pathname, "/api/games/42");
  assert.equal(calls[0].options.redirect, "error");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(result).includes("test-secret"));
});

test("exact lookup validates both the requested path and returned identity", async () => {
  const calls = [];
  const client = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async (url) => {
    calls.push(url.pathname); return response(game);
  } });
  assert.equal((await client.getGame(42)).rawgId, 42);
  assert.equal((await client.getGame("game_42")).rawgId, 42);
  assert.deepEqual(calls, ["/api/games/42", "/api/games/game_42"]);
  for (const bad of [null, 0, -1, "../games", "https://example.com", "a".repeat(201)]) {
    await assert.rejects(client.getGame(bad), RawgError);
  }
  assert.equal(calls.length, 2);
  await assert.rejects(client.getGame("different-game"), /другую игру/);
});

test("empty results need no details; malformed and mismatched responses abort whole batch", async () => {
  const empty = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () => response({ results: [] }) });
  assert.deepEqual(await empty.getGames(), []);
  for (const list of [{}, { results: "bad" }, { results: [{ id: "../other" }] },
    { results: [{ id: 42 }, { id: 42 }] }, { results: Array(11).fill({ id: 1 }) }]) {
    const client = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () => response(list) });
    await assert.rejects(client.getGames(), RawgError);
  }
  let count = 0;
  const wrongGame = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () =>
    ++count === 1 ? response({ results: [{ id: 43 }] }) : response(game) });
  await assert.rejects(wrongGame.getGames(), RawgError);
});

test("quota retries are bounded and respect long Retry-After without retrying early", async () => {
  for (const status of [429, 503]) {
    let count = 0;
    const client = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () =>
      ++count === 1 ? response({}, status, { "retry-after": "0" }) : response({ results: [] }) });
    assert.deepEqual(await client.getGames(), []);
    assert.equal(count, 2);
  }
  let count = 0;
  const limited = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () => {
    count++; return response({}, 429, { "retry-after": "60" });
  } });
  await assert.rejects(limited.getGames(), /лимит/);
  assert.equal(count, 1);
  count = 0;
  const persistent = createRawgClient({ apiKey: "secret", wait: noWait, fetchImpl: async () => {
    count++; return response({}, 503);
  } });
  await assert.rejects(persistent.getGames(), /HTTP 503/);
  assert.equal(count, 2);
});

test("errors do not expose API keys, URLs, response bodies or transport errors", async () => {
  for (const fetchImpl of [async () => { throw new Error("https://api.rawg.io/?key=top-secret"); },
    async () => response({ error: "top-secret" }, 403),
    async () => new Response("top-secret", { status: 200 })]) {
    const client = createRawgClient({ apiKey: "top-secret", fetchImpl, wait: noWait });
    await assert.rejects(client.getGames(), (error) => error instanceof RawgError && !String(error).includes("top-secret"));
  }
});

test("invalid local settings never perform a network request", async () => {
  assert.throws(() => createRawgClient({}), /RAWG_API_KEY/);
  const client = createRawgClient({ apiKey: "secret", fetchImpl: async () => assert.fail("No network expected") });
  for (const options of [{ limit: 0 }, { limit: 41 }, { page: -1 }, { search: 42 }, { search: "a".repeat(201) }]) {
    await assert.rejects(client.getGames(options), RawgError);
  }
});
