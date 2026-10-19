import { validateGameImport } from "./import-games.mjs";

export class RawgError extends Error {}

function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RawgError(`${name}: требуется целое число от ${min} до ${max}`);
  }
  return value;
}

export function parseRawgArgs(args) {
  const options = { output: null, limit: 10, page: 1, search: "" };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--limit", "--page", "--search"].includes(arg)) {
      if (seen.has(arg)) throw new RawgError(`Повторный параметр ${arg}`);
      seen.add(arg);
      const value = args[++i];
      if (value == null || value.startsWith("--")) throw new RawgError(`Не задано значение ${arg}`);
      if (arg === "--search") {
        if (!value.trim() || value.length > 200) throw new RawgError("Поиск: от 1 до 200 символов");
        options.search = value.trim();
      } else {
        if (!/^[1-9]\d*$/.test(value)) throw new RawgError(`${arg}: требуется положительное целое число`);
        options[arg.slice(2)] = integer(Number(value), arg, 1, arg === "--limit" ? 40 : 100000);
      }
    } else if (!arg.startsWith("-") && !options.output) options.output = arg;
    else throw new RawgError("Использование: collect:rawg -- <файл.json> [--limit 10] [--page 1] [--search название]");
  }
  if (!options.output?.endsWith(".json")) throw new RawgError("Укажите выходной файл .json");
  return options;
}

function names(entries, platform = false) {
  if (entries == null) return null;
  if (!Array.isArray(entries)) throw new RawgError("Некорректные метаданные RAWG");
  return [...new Set(entries.map((entry) => {
    const name = (platform ? entry?.platform : entry)?.name;
    if (typeof name !== "string" || !name.trim()) throw new RawgError("Некорректные метаданные RAWG");
    return name.trim();
  }))];
}

export function normalizeRawgGame(game) {
  try {
    if (!game || typeof game !== "object" || typeof game.name !== "string") throw new Error();
    let coverUrl = null;
    if (game.background_image) {
      const url = new URL(game.background_image);
      if (url.protocol !== "https:" || url.hostname !== "media.rawg.io" || url.port
        || url.username || url.password) throw new Error();
      coverUrl = url.href;
    }
    return validateGameImport([{
      rawgId: game.id,
      slug: game.slug,
      title: game.name,
      // Use the plain-text variant; upstream HTML never enters the catalog.
      description: typeof game.description_raw === "string" ? game.description_raw.slice(0, 10000) : null,
      coverUrl,
      developer: names(game.developers)?.join(", ").slice(0, 300) || null,
      publisher: names(game.publishers)?.join(", ").slice(0, 300) || null,
      releaseDate: game.released,
      genres: names(game.genres), platforms: names(game.platforms, true), tags: names(game.tags),
      rating: game.rating, metacritic: game.metacritic, playtime: game.playtime,
    }])[0];
  } catch {
    throw new RawgError("Ответ RAWG не соответствует формату каталога; партия не сохранена");
  }
}

// Server/CLI only. Never import into client components or return request URLs in errors.
export function createRawgClient({ apiKey, fetchImpl = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new RawgError("Добавьте RAWG_API_KEY в .env.local");
  let lastRequestAt = 0;
  async function request(path, params = {}) {
    const url = new URL(`https://api.rawg.io/api/${path}`);
    url.search = new URLSearchParams({ ...params, key: apiKey.trim() }).toString();
    for (let attempt = 0; attempt < 2; attempt++) {
      const delay = Math.max(0, 300 - (Date.now() - lastRequestAt));
      if (delay) await wait(delay);
      lastRequestAt = Date.now();
      let response;
      try {
        response = await fetchImpl(url, {
          headers: { Accept: "application/json" }, redirect: "error",
          signal: AbortSignal.timeout(15000), cache: "no-store",
        });
      } catch { throw new RawgError("RAWG: сеть недоступна или истёк таймаут"); }
      if (response.ok) {
        try { return await response.json(); }
        catch { throw new RawgError("RAWG вернул некорректный JSON"); }
      }
      if (response.status === 401 || response.status === 403) throw new RawgError("RAWG отклонил API-ключ или доступ к API");
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const raw = response.headers.get("retry-after");
        const seconds = raw == null ? 1 : (/^\d+(\.\d+)?$/.test(raw) ? Number(raw) : (Date.parse(raw) - Date.now()) / 1000);
        // Do not retry earlier than requested; long quota limits need a later run.
        if (Number.isFinite(seconds) && seconds <= 5) {
          await response.body?.cancel();
          await wait(Math.max(300, seconds * 1000));
          continue;
        }
      }
      await response.body?.cancel();
      throw new RawgError(response.status === 429 ? "RAWG: лимит запросов исчерпан, повторите позже" : `RAWG: ошибка HTTP ${response.status}`);
    }
  }
  return {
    async getGames({ limit = 10, page = 1, search = "" } = {}) {
      integer(limit, "limit", 1, 40);
      integer(page, "page", 1, 100000);
      if (typeof search !== "string" || search.length > 200) throw new RawgError("Поиск: до 200 символов");
      const list = await request("games", { page: String(page), page_size: String(limit),
        ordering: "-added", ...(search.trim() ? { search: search.trim() } : {}) });
      if (!list || !Array.isArray(list.results) || list.results.length > limit) throw new RawgError("RAWG вернул некорректный список игр");
      const ids = list.results.map((game) => integer(game?.id, "RAWG ID", 1, 2147483647));
      if (new Set(ids).size !== ids.length) throw new RawgError("RAWG вернул повторяющиеся игры");
      const records = [];
      // Fetch details sequentially: list responses omit descriptions and companies.
      // Never follow upstream `next` URLs, which may contain credentials or another host.
      for (const id of ids) {
        const detail = await request(`games/${id}`);
        if (detail?.id !== id) throw new RawgError("RAWG вернул другую игру вместо запрошенной");
        records.push(normalizeRawgGame(detail));
      }
      return records.length ? validateGameImport(records) : [];
    },
  };
}
