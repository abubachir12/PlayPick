import test from "node:test";
import assert from "node:assert/strict";
import { createIgdbClient, normalizeIgdbGames, parseCollectorArgs, IgdbError } from "../lib/igdb.mjs";

const source = [{
  id: 119133, slug: "elden-ring", name: "Elden Ring", summary: "Description",
  cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/test.jpg" },
  involved_companies: [
    { company: { name: "FromSoftware" }, developer: true },
    { company: { name: "FromSoftware" }, developer: true },
    { company: { name: "Bandai Namco" }, publisher: true },
    { company: { name: "Support only" }, supporting: true },
  ],
}];
const okToken = () => Response.json({ access_token: "TEST_TOKEN", expires_in: 3600 });
const makeClient = (fetchImpl, wait = async () => {}) => createIgdbClient({
  clientId: "TEST_ID", clientSecret: "TEST_SECRET", fetchImpl, wait,
});

test("normalizes covers and company roles to the existing importer contract", () => {
  const [game] = normalizeIgdbGames(source);
  assert.equal(game.igdbId, 119133);
  assert.equal(game.coverUrl, "https://images.igdb.com/igdb/image/upload/t_thumb/test.jpg");
  assert.equal(game.developer, "FromSoftware");
  assert.equal(game.publisher, "Bandai Namco");
  assert.deepEqual(normalizeIgdbGames([]), []);
  const [minimal] = normalizeIgdbGames([{ id: 1, slug: "test-game", name: "Test" }]);
  assert.equal(minimal.coverUrl, null);
  assert.equal(minimal.developer, null);
});

test("rejects malformed upstream records and untrusted covers", () => {
  for (const data of [null, {}, [null], [{ id: 1, name: "Missing slug" }],
    [source[0], source[0]], [{ ...source[0], cover: { url: "https://evil.example/cover.jpg" } }],
    [{ ...source[0], cover: { url: "http://images.igdb.com/test.jpg" } }]]) {
    assert.throws(() => normalizeIgdbGames(data), IgdbError);
  }
});

test("validates command arguments and bounds before any network request", () => {
  assert.deepEqual(parseCollectorArgs(["data/games.json", "--limit", "10", "--offset", "50"]),
    { output: "data/games.json", limit: 10, offset: 50 });
  for (const args of [[], ["a.txt"], ["a.json", "--limit", "0"], ["a.json", "--limit", "101"],
    ["a.json", "--offset", "-1"], ["a.json", "--limit"], ["a.json", "b.json"],
    ["a.json", "--limit", "10", "--limit", "20"], ["a.json", "--offset", "1;fields *;"]]) {
    assert.throws(() => parseCollectorArgs(args), IgdbError);
  }
  assert.throws(() => createIgdbClient({ clientId: "", clientSecret: "" }), IgdbError);
});

test("authenticates using form data, caches the token and sends bounded queries", async () => {
  const calls = [];
  const client = makeClient(async (url, options) => {
    calls.push({ url, options });
    return url.includes("oauth2") ? okToken() : Response.json(source);
  });
  await client.getGames({ limit: 10, offset: 50 });
  await client.getGames({ limit: 1 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://id.twitch.tv/oauth2/token");
  assert.equal(calls[0].options.body.get("client_secret"), "TEST_SECRET");
  assert.equal(calls[0].options.body.get("grant_type"), "client_credentials");
  assert.equal(calls[1].url, "https://api.igdb.com/v4/games");
  assert.equal(calls[1].options.headers.Authorization, "Bearer TEST_TOKEN");
  assert.match(calls[1].options.body, /limit 10; offset 50;/);
  assert.equal(calls[1].options.redirect, "error");
});

test("refreshes an expired token exactly once after HTTP 401", async () => {
  let tokens = 0;
  let games = 0;
  const client = makeClient(async (url) => {
    if (url.includes("oauth2")) { tokens++; return okToken(); }
    games++;
    return games === 1 ? new Response("secret response", { status: 401 }) : Response.json(source);
  });
  assert.equal((await client.getGames()).length, 1);
  assert.equal(tokens, 2);
  assert.equal(games, 2);
});

test("retries a rate limit once, then stops instead of an endless loop", async () => {
  let games = 0;
  const waits = [];
  const client = makeClient(async (url) => {
    if (url.includes("oauth2")) return okToken();
    games++;
    return new Response("TEST_SECRET", { status: 429, headers: { "Retry-After": "1" } });
  }, async (ms) => waits.push(ms));
  await assert.rejects(client.getGames(), /HTTP 429/);
  assert.equal(games, 2);
  assert.ok(waits.includes(1000));
});

test("does not expose secrets from service errors or low-level network exceptions", async () => {
  for (const fetchImpl of [
    async () => new Response("TEST_SECRET", { status: 403 }),
    async () => { throw new Error("TEST_SECRET"); },
    async () => Response.json({ access_token: "TEST_SECRET", expires_in: "wrong" }),
  ]) {
    await assert.rejects(makeClient(fetchImpl).getGames(), (error) =>
      error instanceof IgdbError && !error.message.includes("TEST_SECRET"));
  }
});

test("invalid options do not authenticate, and malformed IGDB JSON is rejected", async () => {
  let calls = 0;
  const client = makeClient(async (url) => {
    calls++;
    return url.includes("oauth2") ? okToken() : new Response("not JSON");
  });
  await assert.rejects(client.getGames({ limit: 101 }), IgdbError);
  assert.equal(calls, 0);
  await assert.rejects(client.getGames(), /некорректный JSON/);
});
