import test from "node:test";
import assert from "node:assert/strict";
import { CatalogQueryError, parseCatalogFilters, parseMarketFilters } from "../lib/catalog-query.mjs";
import { COLLECTIONS, COLLECTION_IDS, findCollection, matchesCollection } from "../lib/collections.mjs";
import { expandSearch } from "../lib/search-aliases.mjs";
import { extractPrice, extractStorefront } from "../lib/steam.mjs";
import { describeCandidate } from "../lib/consultant.mjs";

test("storefront flags are 1 or absent and a collection must be a known one", () => {
  assert.deepEqual(parseMarketFilters(new URLSearchParams(), COLLECTION_IDS),
    { deal: false, free: false, russian: false, collection: null });
  assert.deepEqual(parseMarketFilters(new URLSearchParams("deal=1&russian=1&collection=coop"), COLLECTION_IDS),
    { deal: true, free: false, russian: true, collection: "coop" });
  for (const query of ["deal=0", "deal=true", "free=1&free=1", "russian=", "collection=nope", "collection=coop&collection=deals"]) {
    assert.throws(() => parseMarketFilters(new URLSearchParams(query), COLLECTION_IDS), CatalogQueryError, query);
  }
  for (const sort of ["popular", "discount", "price"]) {
    assert.equal(parseCatalogFilters(new URLSearchParams({ sort })).sort, sort);
  }
});

test("collections are plain rules over catalog fields", () => {
  assert.equal(new Set(COLLECTION_IDS).size, COLLECTIONS.length);
  assert.equal(findCollection("nope"), null);
  const game = { tags: ["Co-op", "Horror"], rating: 4.2, playtime: 5, releaseDate: "2010-05-01",
    isFree: false, priceFinal: 499, discountPercent: 50, playersNow: 120 };
  const ids = COLLECTIONS.filter((collection) => matchesCollection(game, collection)).map((collection) => collection.id);
  assert.deepEqual(ids, ["playing-now", "deals", "under-10", "coop", "one-evening", "horror", "classics"]);
  assert.equal(matchesCollection({ ...game, tags: ["Open World"] }, findCollection("one-evening")), false);
  // A paid game with a stray "Free to Play" tag is not free once the store says so.
  assert.equal(matchesCollection({ tags: ["Free to Play"], isFree: false }, findCollection("free")), false);
  const free = { tags: ["Free to Play"], rating: 3, priceFinal: null };
  assert.deepEqual(COLLECTIONS.filter((collection) => matchesCollection(free, collection)).map((c) => c.id), ["free"]);
  // Free and unpriced games are not "under $10": that list is about things you can buy cheaply.
  assert.equal(matchesCollection({ ...game, priceFinal: 0 }, findCollection("under-10")), false);
  assert.equal(matchesCollection({ ...game, priceFinal: 1001 }, findCollection("under-10")), false);
});

test("Russian names of well-known games also search their English titles", () => {
  assert.deepEqual(expandSearch("Ведьмак"), ["Ведьмак", "witcher"]);
  assert.deepEqual(expandSearch("ведьмак 3"), ["ведьмак 3", "witcher 3"]);
  assert.deepEqual(expandSearch("халф лайф 2"), ["халф лайф 2", "half-life 2"]);
  assert.deepEqual(expandSearch("чёрный миф"), ["чёрный миф", "black myth"]);
  assert.deepEqual(expandSearch("Witcher"), ["Witcher"]);
  assert.deepEqual(expandSearch("неизвестная игра"), ["неизвестная игра"]);
  assert.deepEqual(expandSearch("  "), []);
});

test("store prices keep minor units and distinguish free, discounted and not sold", () => {
  assert.deepEqual(extractPrice({ is_free: false, price_overview: { currency: "RUB", initial: 59900, final: 29950, discount_percent: 50 } }),
    { isFree: false, priceFinal: 29950, priceInitial: 59900, discountPercent: 50, priceCurrency: "RUB" });
  assert.deepEqual(extractPrice({ is_free: true }),
    { isFree: true, priceFinal: null, priceInitial: null, discountPercent: null, priceCurrency: null });
  assert.equal(extractPrice({ is_free: false }).priceFinal, null);
  assert.equal(extractPrice({ price_overview: { currency: "rub<script>", final: 100 } }).priceCurrency, null);
  assert.equal(extractPrice({ price_overview: { currency: "RUB", final: -5 } }).priceFinal, null);
});

test("storefront details keep only Steam-hosted media and plain text", () => {
  const cdn = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1";
  const data = extractStorefront({
    is_free: false, price_overview: { currency: "RUB", initial: 100, final: 100, discount_percent: 0 },
    screenshots: [{ path_full: `${cdn}/a.1920x1080.jpg` }, { path_full: "https://evil.example/b.jpg" }],
    movies: [{ name: "Trailer", thumbnail: `${cdn}/movie.293x165.jpg`, hls_h264: "https://video.akamai.steamstatic.com/t/hls.m3u8" },
      { name: "Other", hls_h264: "https://evil.example/x.m3u8" }],
    pc_requirements: { minimum: "<strong>Минимальные:</strong><br><ul><li><strong>ОС:</strong> Windows 10<br></li><li><strong>Дополнительно:</strong></li></ul>" },
    supported_languages: "английский<strong>*</strong>, русский",
    short_description: "Коротко об игре.",
    about_the_game: `<p>Коротко об игре.</p><p>${"Длинный рассказ о мире игры. ".repeat(10)}</p><script>alert(1)</script>`,
  });
  assert.deepEqual(data.screenshots, [`${cdn}/a.1920x1080.jpg`]);
  assert.equal(data.trailer.name, "Trailer");
  assert.equal(data.trailer.hls, "https://video.akamai.steamstatic.com/t/hls.m3u8");
  assert.equal(data.requirements, "ОС: Windows 10");
  assert.equal(data.hasRussian, true);
  assert.ok(data.description.startsWith("Коротко об игре."));
  assert.equal(data.description.match(/Коротко об игре/g).length, 1);
  assert.ok(!data.description.includes("<"));
  const bare = extractStorefront({ supported_languages: "английский" });
  assert.deepEqual([bare.screenshots, bare.trailer, bare.requirements, bare.hasRussian, bare.description], [null, null, null, false, null]);
});

test("the consultant is told real prices so it does not invent them", () => {
  const base = { id: 7, title: "Game", releaseDate: "2020-01-01", genres: ["RPG"], rating: 4.5, playtime: 10, description: "x" };
  const item = (game) => ({ game, reasons: [{ text: "Тег" }] });
  assert.match(describeCandidate(item({ ...base, priceFinal: 1499, priceCurrency: "USD", discountPercent: 50, hasRussian: true })),
    /цена: \$14\.99 в Steam \(регион США\), скидка 50%; есть русский язык;/);
  assert.match(describeCandidate(item({ ...base, isFree: true })), /цена: бесплатная;/);
  assert.doesNotMatch(describeCandidate(item(base)), /цена/);
});

test("each region has its own price; the main region lives in the price columns", async () => {
  const { regionPrice, compactPrice, REGION_IDS, MAIN_REGION } = await import("../lib/regions.mjs");
  assert.equal(MAIN_REGION, "us");
  assert.deepEqual(REGION_IDS, ["us", "kz", "ru", "ua", "by"]);
  const game = { priceFinal: 1499, priceInitial: 2999, discountPercent: 50, priceCurrency: "USD",
    prices: { kz: { final: 240000, initial: 240000, discount: 0, currency: "KZT" }, ru: null } };
  assert.deepEqual(regionPrice(game, "us"), { final: 1499, initial: 2999, discount: 50, currency: "USD" });
  assert.equal(regionPrice(game, "kz").final, 240000);
  assert.equal(regionPrice(game, "ru"), null);   // answered: not sold there
  assert.equal(regionPrice(game, "ua"), null);   // never fetched
  assert.equal(regionPrice({ priceFinal: null }, "us"), null);
  assert.equal(regionPrice(game, "mars").currency, "USD"); // unknown region falls back to the main one
  assert.deepEqual(compactPrice({ priceFinal: 100, priceInitial: null, discountPercent: null, priceCurrency: "UAH" }),
    { final: 100, initial: 100, discount: 0, currency: "UAH" });
  assert.equal(compactPrice({ priceFinal: null, priceInitial: null, discountPercent: null, priceCurrency: null }), null);
});

test("regional prices are collected side by side; a failed region keeps its old value", async () => {
  const { collectRegionPrices } = await import("../lib/market.mjs");
  const answers = {
    us: new Map([[1, { currency: "USD", initial: 2000, final: 1000, discount_percent: 50 }], [2, null]]),
    kz: new Map([[1, { currency: "KZT", initial: 500000, final: 500000, discount_percent: 0 }]]),
    ru: new Map([[1, null], [2, null]]),
    by: new Map([[1, { currency: "USD", initial: 900, final: 900, discount_percent: 0 }]]),
  };
  const steam = { prices: async (ids, region) => { if (!answers[region]) throw new Error("down"); return answers[region]; } };
  const result = await collectRegionPrices(steam, [1, 2, 3]);
  assert.deepEqual([...result.keys()], [1, 2]);                      // 3 is unknown to the main region
  assert.deepEqual(result.get(1), { priceFinal: 1000, priceInitial: 2000, discountPercent: 50, priceCurrency: "USD",
    prices: { kz: { final: 500000, initial: 500000, discount: 0, currency: "KZT" }, ru: null,
      by: { final: 900, initial: 900, discount: 0, currency: "USD" } } });   // ua failed → key absent
  assert.equal(result.get(2).priceFinal, null);
  assert.deepEqual(result.get(2).prices, { kz: null, ru: null, by: null });
  await assert.rejects(collectRegionPrices({ prices: async () => { throw new Error("down"); } }, [1]));
});