import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSteamGame, parseSteamDate, pickCandidates, plainText, slugify, titleKey } from "../lib/steam.mjs";
import { validateGameImport } from "../lib/import-games.mjs";

const spy = { appid: 413150, name: "Stardew Valley™", developer: "ConcernedApe", publisher: "ConcernedApe",
  positive: 900, negative: 100, tags: { RPG: 50, Relaxing: 80, "Farming Sim": 90, Puzzle: 10 } };
const store = {
  type: "game", name: "Stardew Valley", is_free: false,
  short_description: "Вам досталась &quot;старая&quot; ферма.<br>Начните новую жизнь!",
  header_image: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg?t=1",
  screenshots: [{ path_full: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/ss_1.jpg" }],
  developers: ["ConcernedApe"], publishers: ["ConcernedApe"],
  release_date: { coming_soon: false, date: "26 фев. 2016 г." },
  genres: [{ id: "23" }, { id: "3" }, { id: "28" }, { id: "37" }],
  platforms: { windows: true, mac: true, linux: false },
  metacritic: { score: 89 }, content_descriptors: { ids: [] },
};

test("a Steam game becomes a catalog record in the catalog's own vocabulary", () => {
  assert.deepEqual(normalizeSteamGame(spy, store), {
    steamId: 413150, slug: "stardew-valley", title: "Stardew Valley",
    description: "Вам досталась \"старая\" ферма.\nНачните новую жизнь!",
    coverUrl: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/ss_1.jpg",
    developer: "ConcernedApe", publisher: "ConcernedApe", releaseDate: "2016-02-26",
    genres: ["Indie", "RPG", "Simulation", "Puzzle"], platforms: ["PC", "macOS"],
    tags: ["Farming Sim", "Relaxing", "RPG", "Puzzle"], rating: 3.99, metacritic: 89, playtime: null,
  });
  const free = normalizeSteamGame({ ...spy, tags: {} }, { ...store, is_free: true, screenshots: [] });
  assert.deepEqual(free.tags, ["Free to Play"]);
  assert.match(free.coverUrl, /header\.jpg/);
});

test("software, unreleased and adult titles are rejected; foreign image hosts are dropped", () => {
  assert.ok("rejected" in normalizeSteamGame(spy, { ...store, type: "dlc" }));
  assert.ok("rejected" in normalizeSteamGame(spy, null));
  assert.ok("rejected" in normalizeSteamGame(spy, { ...store, genres: [{ id: "57" }] }));
  assert.ok("rejected" in normalizeSteamGame(spy, { ...store, release_date: { coming_soon: true } }));
  assert.ok("rejected" in normalizeSteamGame(spy, { ...store, content_descriptors: { ids: [1, 3] } }));
  assert.ok("rejected" in normalizeSteamGame({ ...spy, tags: { Nudity: 500 } }, store));
  assert.ok("rejected" in normalizeSteamGame({ ...spy, tags: { ...spy.tags, Hentai: 1 } }, store));
  // A mainstream RPG with mature scenes stays: nudity is not among its top tags.
  const rpg = { ...spy, tags: { RPG: 900, "Open World": 800, "Story Rich": 700, Fantasy: 600, Choices: 500, Nudity: 10 } };
  assert.equal(normalizeSteamGame(rpg, { ...store, content_descriptors: { ids: [1, 2, 4, 5] } }).steamId, 413150);
  const foreign = normalizeSteamGame(spy, { ...store, screenshots: [{ path_full: "https://evil.example/x.jpg" }],
    header_image: "http://shared.akamai.steamstatic.com/h.jpg" });
  assert.equal(foreign.coverUrl, null);
});

test("Steam review share is calibrated to the RAWG rating scale", async () => {
  const { steamRating } = await import("../lib/steam.mjs");
  assert.equal(steamRating(0.976), 4.23); // Half-Life 2: RAWG 4.47, naive × 5 would be 4.88
  assert.equal(steamRating(0.75), 3.54);
  assert.equal(steamRating(1), 4.3);
  assert.equal(steamRating(0), 1.24);
});

test("dates, titles, slugs and descriptions are normalized", () => {
  assert.equal(parseSteamDate("Feb 26, 2016"), "2016-02-26");
  assert.equal(parseSteamDate("3 мая. 2019 г."), "2019-05-03");
  assert.equal(parseSteamDate("31 фев. 2019 г."), null);
  assert.equal(parseSteamDate("Скоро"), null);
  assert.equal(titleKey("The Witcher® 3: Wild Hunt"), titleKey("Witcher 3 Wild Hunt"));
  assert.equal(titleKey("The Witcher 3: Wild Hunt — Remastered"), titleKey("The Witcher 3: Wild Hunt"));
  assert.equal(titleKey("Grand Theft Auto V Legacy"), titleKey("Grand Theft Auto V"));
  assert.equal(titleKey("Fallout 4: Game of the Year Edition"), titleKey("Fallout 4"));
  assert.equal(titleKey("Terraria (2011)"), titleKey("Terraria"));
  assert.equal(titleKey("Grand Theft Auto IV: The Complete Edition"), titleKey("Grand Theft Auto IV"));
  assert.equal(titleKey("Disco Elysium - The Final Cut"), titleKey("Disco Elysium"));
  assert.notEqual(titleKey("Dark Souls III"), titleKey("Dark Souls"));
  assert.equal(slugify("Tom Clancy's Rainbow Six® Siege", 1), "tom-clancy-s-rainbow-six-siege");
  assert.equal(slugify("東方", 77), "steam-77");
  assert.equal(plainText("<p>A &amp; B&#33;</p><script>x</script>"), "A & B! x");
});

test("candidates skip known games and poorly reviewed ones, most reviewed first", () => {
  const known = { steamIds: new Set([1]), titles: new Set([titleKey("Portal 2")]) };
  const list = [
    { appid: 1, name: "Known", positive: 9000, negative: 10 },
    { appid: 2, name: "Portal 2™", positive: 9000, negative: 10 },
    { appid: 3, name: "Few reviews", positive: 100, negative: 0 },
    { appid: 4, name: "Disliked", positive: 5000, negative: 5000 },
    { appid: 5, name: "Good", positive: 3000, negative: 100 },
    { appid: 6, name: "Great", positive: 8000, negative: 100 },
  ];
  assert.deepEqual(pickCandidates(list, { known }).map((game) => game.appid), [6, 5]);
});

test("Steam batches are a third import source that cannot be mixed with others", () => {
  assert.equal(validateGameImport([{ steamId: 10, slug: "x", title: "X" }])[0].steamId, 10);
  assert.throws(() => validateGameImport([{ steamId: 10, rawgId: 1, slug: "x", title: "X" }]));
  assert.throws(() => validateGameImport([{ steamId: 10, slug: "x", title: "X" }, { rawgId: 1, slug: "y", title: "Y" }]));
});
