import { validateGameImport } from "./import-games.mjs";

export class IgdbError extends Error {}

export function parseCollectorArgs(args) {
  const options = { output: null, limit: 50, offset: 0 };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--limit" || arg === "--offset") {
      if (seen.has(arg)) throw new IgdbError(`Повторный параметр ${arg}`);
      seen.add(arg);
      const raw = args[++index];
      const value = Number(raw);
      const max = arg === "--limit" ? 100 : 100000;
      const min = arg === "--limit" ? 1 : 0;
      if (!/^\d+$/.test(raw ?? "") || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new IgdbError(`${arg}: требуется целое число от ${min} до ${max}`);
      }
      options[arg.slice(2)] = value;
    } else if (!arg.startsWith("--") && !options.output) {
      options.output = arg;
    } else {
      throw new IgdbError("Использование: npm run collect:igdb -- <файл.json> [--limit 50] [--offset 0]");
    }
  }
  if (!options.output || !options.output.endsWith(".json")) {
    throw new IgdbError("Укажите путь к выходному файлу .json");
  }
  return options;
}

function companies(entries, role) {
  if (!Array.isArray(entries)) return null;
  const names = entries.filter((entry) => entry?.[role] === true)
    .map((entry) => entry.company?.name)
    .filter((name) => typeof name === "string" && name.trim())
    .map((name) => name.trim());
  return [...new Set(names)].join(", ").slice(0, 300) || null;
}

export function normalizeIgdbGames(input) {
  if (!Array.isArray(input) || input.length > 100) {
    throw new IgdbError("IGDB вернул некорректный список игр");
  }
  if (!input.length) return [];
  try {
    return validateGameImport(input.map((game) => {
      if (!game || typeof game !== "object" || typeof game.name !== "string") {
        throw new IgdbError("Некорректная игра в ответе IGDB");
      }
      let coverUrl = null;
      if (game.cover?.url) {
        const raw = game.cover.url;
        if (typeof raw !== "string") throw new IgdbError("Некорректная обложка IGDB");
        const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
        if (url.protocol !== "https:" || url.hostname !== "images.igdb.com" || url.username || url.password) {
          throw new IgdbError("Некорректный адрес обложки IGDB");
        }
        coverUrl = url.href;
      }
      return {
        igdbId: game.id,
        slug: game.slug,
        title: game.name.trim().slice(0, 300),
        description: typeof game.summary === "string" ? game.summary.slice(0, 10000) : null,
        coverUrl,
        developer: companies(game.involved_companies, "developer"),
        publisher: companies(game.involved_companies, "publisher"),
      };
    }));
  } catch {
    throw new IgdbError("Ответ IGDB не соответствует формату импорта; файл не сохранён");
  }
}

// Server/CLI module only. Credentials and access tokens must never reach React.
export function createIgdbClient({ clientId, clientSecret, fetchImpl = fetch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  if (typeof clientId !== "string" || !clientId.trim() || typeof clientSecret !== "string" || !clientSecret.trim()) {
    throw new IgdbError("Добавьте TWITCH_CLIENT_ID и TWITCH_CLIENT_SECRET в .env.local");
  }
  let token = null;
  let tokenExpiresAt = 0;
  let lastRequestAt = 0;

  async function request(url, options, service) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options, redirect: "error", signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new IgdbError(`${service}: сеть недоступна или истёк таймаут`);
    }
    return response;
  }

  async function getToken() {
    if (token && Date.now() < tokenExpiresAt) return token;
    const response = await request("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
    }, "Twitch");
    if (!response.ok) throw new IgdbError(`Twitch: авторизация не удалась (HTTP ${response.status})`);
    let data;
    try { data = await response.json(); } catch { throw new IgdbError("Twitch: некорректный ответ авторизации"); }
    if (typeof data?.access_token !== "string" || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
      throw new IgdbError("Twitch: некорректный ответ авторизации");
    }
    token = data.access_token;
    tokenExpiresAt = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
    return token;
  }

  return {
    async getGames({ limit = 50, offset = 0 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) {
        throw new IgdbError("Некорректные limit или offset");
      }
      const query = `fields id,name,slug,summary,cover.url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; where version_parent = null & cover != null & total_rating_count > 10; sort total_rating_count desc; limit ${limit}; offset ${offset};`;
      let refreshed = false;
      let retriedRateLimit = false;
      while (true) {
        const accessToken = await getToken();
        const pause = Math.max(0, 300 - (Date.now() - lastRequestAt));
        if (pause) await wait(pause);
        lastRequestAt = Date.now();
        const response = await request("https://api.igdb.com/v4/games", {
          method: "POST",
          headers: { "Client-ID": clientId, Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "text/plain" },
          body: query,
        }, "IGDB");
        if (response.status === 401 && !refreshed) {
          token = null;
          refreshed = true;
          continue;
        }
        if (response.status === 429 && !retriedRateLimit) {
          const raw = response.headers.get("Retry-After");
          const seconds = raw ? Number(raw) : 1;
          if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5) {
            throw new IgdbError("IGDB: превышен лимит запросов; повторите запуск позже");
          }
          await wait(Math.max(1000, seconds * 1000));
          retriedRateLimit = true;
          continue;
        }
        if (!response.ok) throw new IgdbError(`IGDB: запрос не удался (HTTP ${response.status})`);
        let data;
        try { data = await response.json(); } catch { throw new IgdbError("IGDB: некорректный JSON"); }
        if (!Array.isArray(data) || data.length > limit) throw new IgdbError("IGDB: некорректный размер ответа");
        return normalizeIgdbGames(data);
      }
    },
  };
}
