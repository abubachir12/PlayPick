import test from "node:test";
import assert from "node:assert/strict";
import { buildAnswerMessages, buildExtractionMessages, ConsultantError, parseAnswer, parseChatRequest,
  parseExtraction } from "../lib/consultant.mjs";
import { LibraryRequestError, parseLibraryChange } from "../lib/library-api.mjs";

const catalog = { genres: ["Action", "RPG", "Indie"], platforms: ["PC", "PlayStation 5"] };
const candidate = (id, title) => ({ game: { id, title, genres: ["RPG"], rating: 4.5, releaseDate: "2020-01-01", description: "x" },
  score: 50, reasons: [{ code: "mood-tag", value: "Story Rich", text: "Тег «Story Rich»" }], sessionFit: {} });

test("chat requests keep the last turns, require a user message last and validate liked IDs", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }))
    .concat({ role: "user", content: " last " });
  const { messages, likedIds } = parseChatRequest({ messages: many, likedIds: [3, 3, 5] });
  assert.equal(messages.length, 12);
  assert.deepEqual(messages.at(-1), { role: "user", content: "last" });
  assert.deepEqual(likedIds, [3, 5]);
  for (const input of [null, {}, { messages: [] }, { messages: [{ role: "system", content: "x" }] },
    { messages: [{ role: "user", content: "" }] }, { messages: [{ role: "user", content: "x".repeat(1501) }] },
    { messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] },
    { messages: [{ role: "user", content: "a" }], likedIds: ["1"] }, { messages: [{ role: "user", content: "a" }], admin: 1 }]) {
    assert.throws(() => parseChatRequest(input), ConsultantError);
  }
});

test("extraction accepts only known moods, genres and platforms, even from messy model output", () => {
  const text = 'Вот JSON:\n```json\n{"mood":"story","genres":["rpg","Strategy","RPG"],"platform":"pc","similarTo":["The Witcher 3"],"freeOnly":"yes","length":"short"}\n```';
  assert.deepEqual(parseExtraction(text, catalog), { mood: "story", genres: ["RPG"], platform: "PC",
    similarTo: ["The Witcher 3"], freeOnly: false, length: "short", offTopic: false });
  assert.equal(parseExtraction("no json at all", catalog).mood, "explore");
  assert.equal(parseExtraction('{"mood":"party"}', catalog).mood, "explore");
  assert.deepEqual(buildExtractionMessages([{ role: "user", content: "хочу RPG" }], catalog)[1].content, "Пользователь: хочу RPG");
});

test("keyword fallback reads mood, genre, platform, price, length and English titles", async () => {
  const { extractLocally } = await import("../lib/consultant.mjs");
  const cat = { genres: ["RPG", "Shooter", "Puzzle"], platforms: ["PC", "PlayStation 5"] };
  assert.deepEqual(extractLocally([{ role: "user", content: "Во что бесплатно поиграть с другом на ПК? Шутер" }], cat),
    { mood: "social", genres: ["Shooter"], platform: "PC", similarTo: [], freeOnly: true, length: null, offTopic: false });
  const story = extractLocally([{ role: "user", content: "Короткая игра с сюжетом как The Witcher 3, часов на 5, ps5" }], cat);
  assert.equal(story.mood, "story");
  assert.equal(story.length, "short");
  assert.equal(story.platform, "PlayStation 5");
  assert.deepEqual(story.similarTo, ["The Witcher 3"]);
  assert.equal(extractLocally([{ role: "user", content: "просто посоветуй" }], cat).mood, "story");
});

test("answers can only show games we offered, and the ID line is stripped from the text", () => {
  const candidates = [candidate(1, "Alpha"), candidate(2, "Beta"), candidate(3, "Gamma")];
  const { reply, games } = parseAnswer("Попробуй [2] Beta и Gamma.\nИГРЫ: 2, 3, 99", candidates);
  assert.equal(reply, "Попробуй Beta и Gamma.");
  assert.deepEqual(games.map((g) => g.id), [2, 3]);
  assert.deepEqual(parseAnswer("Без списка", candidates).games.map((g) => g.id), [1, 2, 3]);
  const system = buildAnswerMessages([{ role: "user", content: "hi" }], candidates, { offTopic: false })[0].content;
  assert.match(system, /\[1\] Alpha \(2020\)/);
  assert.match(system, /ТОЛЬКО игры из списка/);
});

test("library changes are validated before touching the database", () => {
  assert.deepEqual(parseLibraryChange({ action: "add", list: "favorites", gameId: 5 }), { action: "add", list: "favorites", gameId: 5 });
  assert.deepEqual(parseLibraryChange({ action: "merge", favorites: [1, 1, 2] }), { action: "merge", favorites: [1, 2], played: [] });
  assert.deepEqual(parseLibraryChange({ action: "clear", list: "played" }), { action: "clear", list: "played" });
  for (const input of [null, {}, { action: "add", list: "wishlist", gameId: 1 }, { action: "add", list: "played", gameId: 0 },
    { action: "remove", list: "played", gameId: "1" }, { action: "merge", favorites: Array(101).fill(1) },
    { action: "add", list: "played", gameId: 1, extra: true }, { action: "drop" }]) {
    assert.throws(() => parseLibraryChange(input), LibraryRequestError);
  }
});
