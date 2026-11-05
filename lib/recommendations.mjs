export class RecommendationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const ALGORITHM = "rules-v2";

// Weights were tuned against the tag frequencies of the real catalog (RAWG tags and genres).
// Very common tags such as Atmospheric or Singleplayer are left out: they say nothing about the mood.
const MOODS = {
  relax: { label: "Расслабиться",
    tags: { Relaxing: 40, Cozy: 40, Casual: 25, Cute: 25, "Family Friendly": 25, "Walking Simulator": 15,
      Building: 15, Funny: 15, Comedy: 15, Colorful: 15, "Hand-drawn": 10, Beautiful: 10 },
    genres: { Casual: 30, Family: 25, Puzzle: 20, Simulation: 15 },
    avoid: ["Horror", "Survival Horror", "Difficult", "Souls-like", "Competitive", "Fast-Paced", "Gore", "Perma Death", "PvP"] },
  challenge: { label: "Испытать себя",
    tags: { Difficult: 40, "Souls-like": 40, "Precision Platformer": 30, Competitive: 30, "Perma Death": 25,
      Roguelike: 25, "Rogue-lite": 25, "Bullet Hell": 25, PvP: 20, Tactical: 15, Metroidvania: 10, "Hack and Slash": 10 },
    genres: { Fighting: 20, Strategy: 10 } },
  story: { label: "Погрузиться в сюжет",
    tags: { "Story Rich": 45, "Choices Matter": 30, "Visual Novel": 25, "Multiple Endings": 20, Narration: 20,
      "Dynamic Narration": 15, "Lore-Rich": 15, Drama: 15, Mystery: 15, Detective: 15, "Based On A Novel": 15,
      Emotional: 15, Cinematic: 10, "Walking Simulator": 10 },
    genres: { RPG: 15, Adventure: 10 } },
  explore: { label: "Исследовать мир",
    tags: { "Open World": 40, Exploration: 40, Sandbox: 25, Metroidvania: 15, Survival: 15, Crafting: 15, Space: 15,
      "Base Building": 10 },
    genres: { Adventure: 15, RPG: 10 } },
  social: { label: "Поиграть вместе",
    tags: { "Co-op": 40, cooperative: 30, "Online Co-Op": 30, "Local Co-Op": 30, Multiplayer: 25,
      "Local Multiplayer": 25, "Split Screen": 25, Party: 25, "Online multiplayer": 20, PvP: 20, "Team-Based": 20,
      "4 Player Local": 20, "Cross-Platform Multiplayer": 10 },
    genres: { "Massively Multiplayer": 30 } },
};

// RAWG average playtime is for the whole game, so it is offered as game length, never as session length.
const LENGTHS = {
  short: { label: "Короткие (до 8 ч)", min: 1, max: 8 },
  medium: { label: "Средние (8–25 ч)", min: 8, max: 25 },
  long: { label: "Длинные (25+ ч)", min: 25, max: Infinity },
};

// Technical store tags that describe the launcher, not the game; ignored when comparing taste.
const NOISE_TAGS = new Set(["singleplayer", "steam achievements", "full controller support", "steam cloud",
  "steam-trading-cards", "partial controller support", "controller support", "controller", "steam leaderboards",
  "stats", "captions available", "commentary available", "overlay", "valve anti-cheat enabled",
  "includes level editor", "includes source sdk", "steam workshop", "3d vision", "exclusive", "in-app purchases",
  "atmospheric", "great soundtrack"]);

// Editorial session budgets, not RAWG playtime and not guaranteed match durations.
// Add profiles only for verified RAWG IDs; keep the source and limitations explicit.
const SESSION_PROFILES = {
  3272: { minimumMinutes: 15, basis: "editorial",
    sourceUrl: "https://www.rocketleague.com/news/the-ford-rocket-league-freestyle-invitational-primer",
    note: "Оценка PlayPick: отведите 15 минут на один стандартный матч Rocket League с запасом. Поиск соперников и овертайм могут увеличить время; оценка не относится к целому турниру." },
};

const SCORE = { mood: 50, preferred: 20, taste: 15, rating: 10, critics: 5, session: 10, max: 100 };

const normalize = (value) => value.normalize("NFKC").trim().toLowerCase();
const values = (input) => Array.isArray(input) ? input.filter((value) => typeof value === "string") : [];

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RecommendationError(`${name}: требуется целое число от ${min} до ${max}`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new RecommendationError(`${name}: требуется непустая строка длиной до 200 символов`);
  }
  return value.trim();
}

function idList(input, name) {
  const raw = input === undefined ? [] : input;
  if (!Array.isArray(raw) || raw.length > 100) throw new RecommendationError(`${name}: массив до 100 локальных ID игр`);
  return [...new Set(raw.map((id) => boundedInteger(id, name, 1, 2147483647)))];
}

export function parseRecommendationPreferences(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RecommendationError("Требуется JSON-объект");
  const allowed = ["mood", "platform", "preferredGenres", "excludeIds", "likedIds", "sessionMinutes",
    "includeUnknownSession", "freeOnly", "length", "limit"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new RecommendationError("Неизвестный параметр подбора");
  if (typeof input.mood !== "string" || !Object.hasOwn(MOODS, input.mood)) throw new RecommendationError("Выберите настроение из /api/recommendations/options");
  const limit = input.limit === undefined ? 6 : boundedInteger(input.limit, "limit", 1, 20);
  const platform = input.platform === undefined ? null : text(input.platform, "platform");
  const rawGenres = input.preferredGenres === undefined ? [] : input.preferredGenres;
  if (!Array.isArray(rawGenres) || rawGenres.length > 5) throw new RecommendationError("preferredGenres: массив до 5 названий");
  const genres = new Map(rawGenres.map((genre) => { const name = text(genre, "preferredGenres"); return [normalize(name), name]; }));
  const excludeIds = idList(input.excludeIds, "excludeIds");
  const likedIds = idList(input.likedIds, "likedIds");
  const sessionMinutes = input.sessionMinutes === undefined ? null : boundedInteger(input.sessionMinutes, "sessionMinutes", 5, 240);
  if (input.includeUnknownSession !== undefined && (typeof input.includeUnknownSession !== "boolean" || sessionMinutes === null)) {
    throw new RecommendationError("includeUnknownSession: boolean, применяется только вместе с sessionMinutes");
  }
  if (input.freeOnly !== undefined && typeof input.freeOnly !== "boolean") throw new RecommendationError("freeOnly: boolean");
  if (input.length !== undefined && (typeof input.length !== "string" || !Object.hasOwn(LENGTHS, input.length))) {
    throw new RecommendationError("length: short, medium или long");
  }
  return { mood: input.mood, platform, preferredGenres: [...genres.values()], excludeIds, likedIds,
    sessionMinutes, includeUnknownSession: input.includeUnknownSession ?? true,
    freeOnly: input.freeOnly ?? false, length: input.length ?? null, limit };
}

export async function readRecommendationRequest(request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RecommendationError("Требуется Content-Type: application/json", 415);
  }
  const max = 8192;
  if (Number(request.headers.get("content-length")) > max) throw new RecommendationError("JSON не должен превышать 8192 байта", 413);
  if (!request.body) throw new RecommendationError("Тело запроса отсутствует");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new RecommendationError("JSON не должен превышать 8192 байта", 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RecommendationError) throw error;
    throw new RecommendationError("Не удалось прочитать JSON");
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let input;
  try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new RecommendationError("Некорректный JSON"); }
  return parseRecommendationPreferences(input);
}

export function recommendationOptions() {
  return { algorithm: ALGORITHM, moods: Object.entries(MOODS).map(([id, mood]) => ({ id, label: mood.label })),
    lengths: Object.entries(LENGTHS).map(([id, length]) => ({ id, label: length.label })),
    limit: { min: 1, max: 20, default: 6 }, sessionMinutes: { min: 5, max: 240 },
    sessionEstimates: "editorial", unknownSessionsIncludedByDefault: true,
    catalogFiltersUrl: "/api/catalog/filters" };
}

// The set of meaningful tags and genres used to compare a candidate with liked games.
function features(game) {
  const set = new Set();
  for (const tag of values(game.tags)) { const name = normalize(tag); if (!NOISE_TAGS.has(name)) set.add(`t:${name}`); }
  for (const genre of values(game.genres)) set.add(`g:${normalize(genre)}`);
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return shared / (a.size + b.size - shared);
}

const isFree = (game) => [...values(game.tags), ...values(game.genres)].some((name) => normalize(name) === "free to play");

export function rankRecommendations(games, preferences) {
  const mood = MOODS[preferences.mood];
  const likedIds = preferences.likedIds ?? [];
  const excluded = new Set([...preferences.excludeIds, ...likedIds]);
  const preferred = new Set(preferences.preferredGenres.map(normalize));
  const length = preferences.length ? LENGTHS[preferences.length] : null;
  const liked = games.filter((game) => likedIds.includes(game.id)).map((game) => ({ game, features: features(game) }));
  const ranked = [];
  let unknownIncluded = 0;
  let unknownExcluded = 0;
  for (const game of games) {
    if (excluded.has(game.id)) continue;
    const platforms = values(game.platforms);
    if (preferences.platform && !platforms.some((name) => normalize(name) === normalize(preferences.platform))) continue;
    if (preferences.freeOnly && !isFree(game)) continue;
    if (length && !(typeof game.playtime === "number" && game.playtime >= length.min && game.playtime <= length.max)) continue;
    const tags = new Set(values(game.tags).map(normalize));
    const genres = values(game.genres);
    const genreSet = new Set(genres.map(normalize));
    if (mood.avoid?.some((name) => tags.has(normalize(name)) || genreSet.has(normalize(name)))) continue;
    const moodReasons = [];
    let moodScore = 0;
    for (const [field, weights, actual] of [["tag", mood.tags, tags], ["genre", mood.genres, genreSet]]) {
      for (const [name, weight] of Object.entries(weights)) {
        if (!actual.has(normalize(name))) continue;
        moodScore += weight;
        moodReasons.push({ weight, code: `mood-${field}`, value: name,
          text: `${field === "tag" ? "Тег" : "Жанр"} «${name}» учитывается в режиме «${mood.label}»` });
      }
    }
    // Quality and preferences cannot promote a game with no mood evidence.
    if (moodScore === 0) continue;
    let score = Math.min(SCORE.mood, moodScore);
    // The strongest evidence is shown first; ties keep the declared order.
    const explanations = moodReasons.sort((a, b) => b.weight - a.weight).slice(0, 3)
      .map((reason) => ({ code: reason.code, value: reason.value, text: reason.text }));
    const matchedGenres = genres.filter((name) => preferred.has(normalize(name)));
    score += Math.min(SCORE.preferred, matchedGenres.length * 10);
    for (const name of matchedGenres) explanations.push({ code: "preferred-genre", value: name, text: `Предпочитаемый жанр: ${name}` });
    if (liked.length) {
      const own = features(game);
      let best = null;
      for (const item of liked) {
        const similarity = jaccard(own, item.features);
        if (!best || similarity > best.similarity || (similarity === best.similarity && item.game.id < best.game.id)) {
          best = { game: item.game, similarity };
        }
      }
      // A single shared tag is not "similar": the bonus starts at roughly a fifth of features in common.
      const bonus = Math.min(SCORE.taste, Math.round(best.similarity * 40));
      if (bonus >= 8) {
        score += bonus;
        explanations.push({ code: "taste", value: best.game.title, text: `Похоже на «${best.game.title}» из избранного` });
      }
    }
    if (preferences.platform) explanations.push({ code: "platform", value: preferences.platform, text: `Есть на платформе ${preferences.platform}` });
    if (preferences.freeOnly) explanations.push({ code: "free", value: "Free to Play", text: "Бесплатная игра" });
    if (length) explanations.push({ code: "length", value: String(game.playtime), text: `В среднем ${game.playtime} ч по данным RAWG` });
    const profile = SESSION_PROFILES[game.rawgId];
    const sessionFit = { status: "not-requested", minimumMinutes: profile?.minimumMinutes ?? null,
      basis: profile?.basis ?? null, sourceUrl: profile?.sourceUrl ?? null, note: profile?.note ?? null };
    if (preferences.sessionMinutes !== null) {
      if (profile) {
        if (profile.minimumMinutes > preferences.sessionMinutes) continue;
        score += SCORE.session;
        sessionFit.status = "estimated-fit";
        explanations.push({ code: "session", value: String(profile.minimumMinutes), text: `По редакторской оценке можно запланировать сессию от ${profile.minimumMinutes} минут` });
      } else {
        if (!preferences.includeUnknownSession) { unknownExcluded++; continue; }
        unknownIncluded++;
        sessionFit.status = "unknown";
        sessionFit.note = "Данных о длительности сессии нет. Средний playtime RAWG не используется как длительность партии.";
      }
    }
    if (typeof game.rating === "number" && Number.isFinite(game.rating) && game.rating >= 0 && game.rating <= 5) {
      score += Math.round(game.rating * 2);
    }
    if (Number.isInteger(game.metacritic) && game.metacritic >= 85 && game.metacritic <= 100) {
      score += SCORE.critics;
      explanations.push({ code: "critics", value: String(game.metacritic), text: `Высокие оценки критиков: Metacritic ${game.metacritic}` });
    }
    ranked.push({ game, score: Math.min(SCORE.max, score), reasons: explanations, sessionFit });
  }
  // The score is a rule-based ranking, not a probability or a percent of enjoyment.
  ranked.sort((a, b) => b.score - a.score || a.game.id - b.game.id);
  const items = diversify(ranked, preferences.limit);
  const warnings = [];
  if (unknownIncluded) warnings.push({ code: "unknown-session-included", text: "У части подходящих игр нет оценки длительности сессии; проверьте sessionFit." });
  if (unknownExcluded) warnings.push({ code: "unknown-session-excluded", text: "Игры без оценки длительности сессии исключены строгим фильтром времени." });
  if (!ranked.length) warnings.push({ code: "no-matches", text: "В каталоге нет игр под выбранные условия. Попробуйте изменить условия подбора." });
  return { items, meta: { algorithm: ALGORITHM, preferences,
    eligibleCount: ranked.length, returnedCount: items.length,
    session: { unknownIncluded, unknownExcluded }, likedUsed: liked.length, warnings } };
}

// "Grand Theft Auto: San Andreas", "Grand Theft Auto IV" and "Grand Theft Auto III" share one series key.
export function seriesKey(title) {
  if (typeof title !== "string") return "";
  return normalize(title).split(/[:–—]| - /)[0]
    .replace(/^the\s+/, "")
    .replace(/\s+(\d+|[ivx]+)(\s.*)?$/, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
}

// One studio or series should not fill the whole page: each repeat costs points, for ordering only.
const REPEAT_PENALTY = { developer: 12, series: 18 };

function diversify(ranked, limit) {
  const pool = ranked.slice(0, Math.max(limit * 4, 40));
  const picked = [];
  const developers = new Map();
  const series = new Map();
  const keys = (item) => ({
    developer: typeof item.game.developer === "string" ? normalize(item.game.developer) : "",
    series: seriesKey(item.game.title),
  });
  while (picked.length < limit && pool.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    pool.forEach((item, index) => {
      const key = keys(item);
      const value = item.score
        - (key.developer ? (developers.get(key.developer) ?? 0) * REPEAT_PENALTY.developer : 0)
        - (key.series ? (series.get(key.series) ?? 0) * REPEAT_PENALTY.series : 0);
      if (value > bestValue) { bestValue = value; bestIndex = index; }
    });
    const [item] = pool.splice(bestIndex, 1);
    const key = keys(item);
    if (key.developer) developers.set(key.developer, (developers.get(key.developer) ?? 0) + 1);
    if (key.series) series.set(key.series, (series.get(key.series) ?? 0) + 1);
    picked.push(item);
  }
  return picked;
}
