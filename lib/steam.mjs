import { validateGameImport } from "./import-games.mjs";

// Second catalog source while RAWG is unavailable: SteamSpy gives popularity, reviews and community tags,
// the Steam store gives the card (Russian description, genres, platforms, dates, images).
// Server/CLI only; no keys are needed.

export class SteamError extends Error {}

// Steam genre IDs → the genre names the catalog already uses (RAWG naming).
const GENRES = { 1: "Action", 2: "Strategy", 3: "RPG", 4: "Casual", 9: "Racing", 18: "Sports", 23: "Indie",
  25: "Adventure", 28: "Simulation", 29: "Massively Multiplayer" };
// Genres RAWG has but Steam expresses only as community tags.
const TAG_GENRES = { FPS: "Shooter", Shooter: "Shooter", "Third-Person Shooter": "Shooter", Puzzle: "Puzzle",
  Platformer: "Platformer", "2D Platformer": "Platformer", "3D Platformer": "Platformer", Fighting: "Fighting",
  Arcade: "Arcade", "Card Game": "Card", "Board Game": "Board Games", "Family Friendly": "Family" };
// Software rather than games: Animation & Modeling … Web Publishing.
const SOFTWARE_GENRES = new Set([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
// Adult-only games stay out of a study catalog. Mainstream RPGs also carry nudity tags and descriptor 4,
// so those count only when they dominate the game's top tags.
const ADULT_ONLY_DESCRIPTOR = 3;
const ADULT_TAGS = new Set(["nsfw", "hentai"]);
const ADULT_THEMES = new Set(["sexual content", "nudity"]);
const PLATFORMS = { windows: "PC", mac: "macOS", linux: "Linux" };
const MAX_TAGS = 20;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  янв: 1, фев: 2, мар: 3, апр: 4, мая: 5, май: 5, июн: 6, июл: 7, авг: 8, сен: 9, окт: 10, ноя: 11, дек: 12 };

// Steam formats dates per language: "26 фев. 2016 г.", "Feb 26, 2016", "26 Feb, 2016". Unknown → null.
export function parseSteamDate(value) {
  if (typeof value !== "string") return null;
  const text = value.toLowerCase();
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
  const month = Object.entries(MONTHS).find(([name]) => new RegExp(`(^|[^\\p{L}])${name}`, "u").test(text))?.[1];
  const day = text.replace(year ?? "", "").match(/\b(\d{1,2})\b/)?.[1];
  if (!year || !month || !day) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso ? iso : null;
}

export function cleanTitle(title) {
  return typeof title === "string" ? title.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim() : "";
}

// Store re-releases ("… Legacy", "… — Remastered", "… GOTY Edition") are the same game for a catalog.
const EDITION = /\s*[-—–:]?\s*(?:\((?:[^)]*)\)|(?:the )?(?:legacy|enhanced(?: edition)?|remastered|definitive edition|game of the year(?: edition)?|goty(?: edition)?|complete edition|anniversary edition|director'?s cut|final cut|ultimate edition|deluxe edition|special edition)|re-elected)\s*$/i;

// Comparable form of a title, to skip games the catalog already has from RAWG.
export function titleKey(title) {
  let base = cleanTitle(title);
  for (let next = base.replace(EDITION, ""); next && next !== base; next = base.replace(EDITION, "")) base = next;
  return base.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/&/g, "and").replace(/^the\s+/, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

export function slugify(title, appId) {
  const slug = cleanTitle(title).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120).replace(/-+$/, "");
  return slug || `steam-${appId}`;
}

const ENTITIES = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…" };

// Descriptions are shown as plain text; drop any markup and decode entities.
export function plainText(html) {
  if (typeof html !== "string") return null;
  const text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
      if (code[0] === "#") {
        const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isInteger(point) && point > 31 && point < 0x110000 ? String.fromCodePoint(point) : " ";
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  return text ? text.slice(0, 10000) : null;
}

function steamImage(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".steamstatic.com") || url.port || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

// Steam's share of positive reviews runs higher than RAWG's 0–5 player rating (mean 4.48 vs 3.98 when × 5).
// Least-squares fit over the 214 games present in both sources (November 2026):
// RAWG ≈ 3.064 × share + 1.237, which halves the error of the naive × 5 (RMSE 0.61 → 0.33).
export const STEAM_RATING_FIT = { slope: 3.064, intercept: 1.237, games: 214 };
export function steamRating(share) {
  const value = STEAM_RATING_FIT.slope * share + STEAM_RATING_FIT.intercept;
  return Math.round(Math.min(5, Math.max(0, value)) * 100) / 100;
}

// Returns a catalog record, or { rejected: reason } for things that are not games we want to show.
export function normalizeSteamGame(spy, store) {
  const appId = spy?.appid;
  if (!Number.isSafeInteger(appId) || appId < 1) throw new SteamError("SteamSpy: некорректный appid");
  if (!store || typeof store !== "object") return { rejected: "нет карточки в магазине" };
  if (store.type !== "game") return { rejected: `тип ${store.type}` };
  if (store.release_date?.coming_soon) return { rejected: "ещё не вышла" };
  const genreIds = Array.isArray(store.genres) ? store.genres.map((genre) => Number(genre?.id)) : [];
  if (genreIds.some((id) => SOFTWARE_GENRES.has(id))) return { rejected: "программа, а не игра" };
  const descriptorIds = Array.isArray(store.content_descriptors?.ids) ? store.content_descriptors.ids : [];
  // SteamSpy tags arrive as { name: votes }, most voted first.
  const tags = spy.tags && typeof spy.tags === "object" && !Array.isArray(spy.tags)
    ? Object.entries(spy.tags).filter(([, votes]) => Number.isFinite(votes)).sort((a, b) => b[1] - a[1])
      .map(([name]) => name.trim()).filter((name) => name && name.length <= 200)
    : [];
  if (descriptorIds.includes(ADULT_ONLY_DESCRIPTOR) || tags.some((tag) => ADULT_TAGS.has(tag.toLowerCase()))
    || tags.slice(0, 5).some((tag) => ADULT_THEMES.has(tag.toLowerCase()))) {
    return { rejected: "контент для взрослых" };
  }

  const title = cleanTitle(spy.name) || cleanTitle(store.name);
  if (!title) return { rejected: "нет названия" };
  const topTags = tags.slice(0, MAX_TAGS);
  if (store.is_free && !topTags.some((tag) => tag.toLowerCase() === "free to play")) topTags.push("Free to Play");
  const genres = [...new Set([
    ...genreIds.map((id) => GENRES[id]).filter(Boolean),
    ...tags.slice(0, MAX_TAGS).map((tag) => TAG_GENRES[tag]).filter(Boolean),
  ])];
  const platforms = Object.entries(PLATFORMS).filter(([key]) => store.platforms?.[key] === true).map(([, name]) => name);
  const positive = Number(spy.positive);
  const negative = Number(spy.negative);
  const reviews = positive + negative;
  const rating = Number.isFinite(reviews) && reviews > 0 && positive >= 0 && negative >= 0
    ? steamRating(positive / reviews) : null;
  const metacritic = Number.isInteger(store.metacritic?.score) && store.metacritic.score <= 100 ? store.metacritic.score : null;
  const join = (list) => Array.isArray(list) ? list.filter((name) => typeof name === "string" && name.trim()).join(", ").slice(0, 300) || null : null;
  const screenshot = Array.isArray(store.screenshots) ? steamImage(store.screenshots[0]?.path_full) : null;

  return validateGameImport([{
    steamId: appId,
    slug: slugify(title, appId),
    title,
    description: plainText(store.short_description) ?? plainText(store.about_the_game),
    // A wide screenshot matches the RAWG backgrounds the rest of the catalog uses; the header art is a fallback.
    coverUrl: screenshot ?? steamImage(store.header_image),
    developer: join(store.developers) ?? (typeof spy.developer === "string" ? spy.developer.slice(0, 300) || null : null),
    publisher: join(store.publishers) ?? (typeof spy.publisher === "string" ? spy.publisher.slice(0, 300) || null : null),
    releaseDate: parseSteamDate(store.release_date?.date),
    genres: genres.length ? genres : null,
    platforms: platforms.length ? platforms : null,
    tags: topTags.length ? topTags : null,
    rating,
    metacritic,
    // SteamSpy no longer publishes playtime; null keeps these games out of length filters instead of guessing.
    playtime: null,
  }])[0];
}

const MAX_SCREENSHOTS = 8;

// Price block of the store (regional). A paid game without price_overview is not sold in that region.
export function extractPrice(store) {
  const price = store?.price_overview;
  const amount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647 ? value : null;
  const final = amount(price?.final);
  return {
    isFree: store?.is_free === true,
    priceFinal: final,
    priceInitial: final == null ? null : amount(price?.initial) ?? final,
    discountPercent: final == null ? null
      : Number.isInteger(price?.discount_percent) && price.discount_percent > 0 && price.discount_percent <= 100 ? price.discount_percent : 0,
    priceCurrency: final != null && typeof price?.currency === "string" && /^[A-Z]{3}$/.test(price.currency) ? price.currency : null,
  };
}

// Everything the game page shows beyond the catalog card: gallery, trailer, requirements, language, long text.
export function extractStorefront(store) {
  const screenshots = (Array.isArray(store?.screenshots) ? store.screenshots : [])
    .map((shot) => steamImage(shot?.path_full)).filter(Boolean).slice(0, MAX_SCREENSHOTS);
  const movie = (Array.isArray(store?.movies) ? store.movies : []).find((item) => steamMedia(item?.hls_h264));
  const requirements = plainText(String(store?.pc_requirements?.minimum ?? "")
    .replace(/<\/li>|<\/p>/gi, "\n").replace(/<strong>\s*(Минимальные|Minimum):?\s*<\/strong>/i, ""));
  const short = plainText(store?.short_description);
  // The long text often opens with the same sentence as the short one; keep both only when it adds something.
  const about = plainText(String(store?.about_the_game ?? "").replace(/<\/(p|li|h[1-6]|ul)>/gi, "\n"));
  const flat = (text) => (text ?? "").replace(/\s+/g, " ").toLowerCase();
  const description = about && about.length > (short?.length ?? 0) + 80
    ? (short && !flat(about).startsWith(flat(short).slice(0, 60)) ? `${short}\n\n${about}` : about)
    : short ?? about;
  return {
    ...extractPrice(store),
    screenshots: screenshots.length ? screenshots : null,
    trailer: movie ? {
      name: typeof movie.name === "string" ? movie.name.slice(0, 200) : "Трейлер",
      thumbnail: steamImage(movie.thumbnail) ?? "",
      hls: steamMedia(movie.hls_h264),
    } : null,
    // Labels the store left empty ("Дополнительно:") are dropped.
    requirements: requirements ? requirements.split("\n").filter((line) => !/:\s*$/.test(line)).join("\n").slice(0, 2000) || null : null,
    hasRussian: typeof store?.supported_languages === "string" ? /русский|russian/i.test(store.supported_languages) : null,
    description: description ? description.slice(0, 4000) : null,
  };
}

function steamMedia(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".steamstatic.com") && !url.port && !url.username ? url.href : null;
  } catch { return null; }
}

// Popular, well-reviewed games that are not in the catalog yet, most reviewed first.
export function pickCandidates(list, { known, minReviews = 2000, minPositive = 0.75 }) {
  return list.filter((game) => {
    const positive = Number(game?.positive);
    const negative = Number(game?.negative);
    const total = positive + negative;
    return Number.isSafeInteger(game?.appid) && game.appid > 0 && typeof game.name === "string"
      && total >= minReviews && positive / total >= minPositive
      && !known.steamIds.has(game.appid) && !known.titles.has(titleKey(game.name));
  }).sort((a, b) => b.positive - a.positive);
}

export function createSteamClient({ fetchImpl = fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  // Both services ask for slow clients: SteamSpy ~1 request/s (list: 1/min), the store ~200 requests per 5 minutes.
  const pace = { "steamspy.com": 1100, "store.steampowered.com": 1600 };
  const last = {};
  async function request(url) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const delay = Math.max(0, (pace[url.hostname] ?? 1000) - (Date.now() - (last[url.hostname] ?? 0)));
      if (delay) await wait(delay);
      last[url.hostname] = Date.now();
      let response;
      try {
        response = await fetchImpl(url, { headers: { Accept: "application/json" }, redirect: "error",
          signal: AbortSignal.timeout(30000), cache: "no-store" });
      } catch {
        if (attempt < 3) { await wait(5000); continue; }
        throw new SteamError(`${url.hostname}: сеть недоступна или истёк таймаут`);
      }
      if (response.ok) {
        try { return await response.json(); } catch { throw new SteamError(`${url.hostname} вернул некорректный JSON`); }
      }
      await response.body?.cancel();
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await wait(response.status === 429 ? 60000 : 5000);
        continue;
      }
      throw new SteamError(`${url.hostname}: ошибка HTTP ${response.status}`);
    }
  }
  return {
    async listPopular(page = 0) {
      const url = new URL("https://steamspy.com/api.php");
      url.search = new URLSearchParams({ request: "all", page: String(page) }).toString();
      // SteamSpy is often overloaded and answers 200 with "Too many connections" instead of JSON; ask again.
      for (let attempt = 0; ; attempt++) {
        let data = null;
        try { data = await request(url); } catch (error) { if (attempt >= 9) throw error; }
        const games = data && typeof data === "object" ? Object.values(data) : [];
        if (games.length) return games;
        if (attempt >= 9) throw new SteamError("SteamSpy вернул некорректный список");
        await wait(8000);
      }
    },
    async spyDetails(appId) {
      const url = new URL("https://steamspy.com/api.php");
      url.search = new URLSearchParams({ request: "appdetails", appid: String(appId) }).toString();
      const data = await request(url);
      if (data?.appid !== appId) throw new SteamError("SteamSpy вернул другую игру");
      return data;
    },
    async storeDetails(appId, region = "ru") {
      const url = new URL("https://store.steampowered.com/api/appdetails");
      url.search = new URLSearchParams({ appids: String(appId), l: "russian", cc: region }).toString();
      const data = await request(url);
      const entry = data?.[String(appId)];
      return entry?.success ? entry.data : null;
    },
    // Official Steam Web API, no key: players in the game right now. Unknown or failed lookups are skipped.
    async playersNow(appIds, concurrency = 16) {
      const result = new Map();
      for (let start = 0; start < appIds.length; start += concurrency) {
        await Promise.all(appIds.slice(start, start + concurrency).map(async (id) => {
          try {
            const url = new URL("https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/");
            url.search = new URLSearchParams({ appid: String(id) }).toString();
            const response = await fetchImpl(url, { headers: { Accept: "application/json" }, redirect: "error",
              signal: AbortSignal.timeout(10000), cache: "no-store" });
            if (!response.ok) return void await response.body?.cancel();
            const count = (await response.json())?.response?.player_count;
            if (Number.isSafeInteger(count) && count >= 0 && count <= 2147483647) result.set(id, count);
          } catch { /* one missing number is not worth failing the batch */ }
        }));
      }
      return result;
    },
    // Store search by title: finds the Steam twin of a game imported from another source.
    async search(term, region = "ru") {
      const url = new URL("https://store.steampowered.com/api/storesearch/");
      url.search = new URLSearchParams({ term, l: "english", cc: region }).toString();
      const data = await request(url);
      return (Array.isArray(data?.items) ? data.items : [])
        .filter((item) => item?.type === "app" && Number.isSafeInteger(item.id) && typeof item.name === "string")
        .map((item) => ({ appid: item.id, name: item.name }));
    },
    // The store accepts many app IDs at once only for the price filter: one request per 100 games.
    async prices(appIds, region = "ru") {
      const result = new Map();
      for (let start = 0; start < appIds.length; start += 100) {
        const chunk = appIds.slice(start, start + 100);
        const url = new URL("https://store.steampowered.com/api/appdetails");
        url.search = new URLSearchParams({ appids: chunk.join(","), filters: "price_overview", cc: region }).toString();
        const data = await request(url);
        for (const id of chunk) {
          const entry = data?.[String(id)];
          // success with an empty data array means "exists, but free or not sold here".
          if (entry?.success) result.set(id, Array.isArray(entry.data) ? null : entry.data?.price_overview ?? null);
        }
      }
      return result;
    },
  };
}
