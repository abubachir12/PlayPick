export class RecommendationError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const MOODS = {
  relax: { label: "Расслабиться", tags: { Relaxing: 40, Casual: 25, Cozy: 40 },
    genres: { Puzzle: 20, Casual: 30, Simulation: 15 },
    avoid: ["Horror", "Survival Horror", "Difficult", "Souls-like", "Competitive", "Fast-Paced"] },
  challenge: { label: "Испытать себя", tags: { Difficult: 40, "Souls-like": 35, Competitive: 30,
    Roguelike: 25, "Rogue-lite": 25, "Precision Platformer": 30 }, genres: {} },
  story: { label: "Погрузиться в сюжет", tags: { "Story Rich": 45, "Choices Matter": 30,
    Narration: 25, "Visual Novel": 25 }, genres: { RPG: 15, Adventure: 10 } },
  explore: { label: "Исследовать мир", tags: { "Open World": 40, Exploration: 40, Sandbox: 25 },
    genres: { Adventure: 15, RPG: 10 } },
  social: { label: "Поиграть вместе", tags: { "Co-op": 40, "Online Co-Op": 30,
    "Local Co-Op": 30, Multiplayer: 25, "Local Multiplayer": 25 },
    genres: { "Massively Multiplayer": 30 } },
};

// Editorial session budgets, not RAWG playtime and not guaranteed match durations.
// Add profiles only for verified RAWG IDs; keep the source and limitations explicit.
const SESSION_PROFILES = {
  3272: { minimumMinutes: 15, basis: "editorial",
    sourceUrl: "https://www.rocketleague.com/news/the-ford-rocket-league-freestyle-invitational-primer",
    note: "Оценка PlayPick: отведите 15 минут на один стандартный матч Rocket League с запасом. Поиск соперников и овертайм могут увеличить время; оценка не относится к целому турниру." },
};

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

export function parseRecommendationPreferences(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new RecommendationError("Требуется JSON-объект");
  const allowed = ["mood", "platform", "preferredGenres", "excludeIds", "sessionMinutes", "includeUnknownSession", "limit"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new RecommendationError("Неизвестный параметр подбора");
  if (typeof input.mood !== "string" || !Object.hasOwn(MOODS, input.mood)) throw new RecommendationError("Выберите настроение из /api/recommendations/options");
  const limit = input.limit === undefined ? 6 : boundedInteger(input.limit, "limit", 1, 20);
  const platform = input.platform === undefined ? null : text(input.platform, "platform");
  const rawGenres = input.preferredGenres === undefined ? [] : input.preferredGenres;
  if (!Array.isArray(rawGenres) || rawGenres.length > 5) throw new RecommendationError("preferredGenres: массив до 5 названий");
  const genres = new Map(rawGenres.map((genre) => { const name = text(genre, "preferredGenres"); return [normalize(name), name]; }));
  const rawIds = input.excludeIds === undefined ? [] : input.excludeIds;
  if (!Array.isArray(rawIds) || rawIds.length > 100) throw new RecommendationError("excludeIds: массив до 100 локальных ID игр");
  const excludeIds = [...new Set(rawIds.map((id) => boundedInteger(id, "excludeIds", 1, 2147483647)))];
  const sessionMinutes = input.sessionMinutes === undefined ? null : boundedInteger(input.sessionMinutes, "sessionMinutes", 5, 240);
  if (input.includeUnknownSession !== undefined && (typeof input.includeUnknownSession !== "boolean" || sessionMinutes === null)) {
    throw new RecommendationError("includeUnknownSession: boolean, применяется только вместе с sessionMinutes");
  }
  return { mood: input.mood, platform, preferredGenres: [...genres.values()], excludeIds,
    sessionMinutes, includeUnknownSession: input.includeUnknownSession ?? true, limit };
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
  return { algorithm: "rules-v1", moods: Object.entries(MOODS).map(([id, mood]) => ({ id, label: mood.label })),
    limit: { min: 1, max: 20, default: 6 }, sessionMinutes: { min: 5, max: 240 },
    sessionEstimates: "editorial", unknownSessionsIncludedByDefault: true,
    catalogFiltersUrl: "/api/catalog/filters" };
}

export function rankRecommendations(games, preferences) {
  const mood = MOODS[preferences.mood];
  const excluded = new Set(preferences.excludeIds);
  const preferred = new Set(preferences.preferredGenres.map(normalize));
  const ranked = [];
  let unknownIncluded = 0;
  let unknownExcluded = 0;
  for (const game of games) {
    if (excluded.has(game.id)) continue;
    const platforms = values(game.platforms);
    if (preferences.platform && !platforms.some((name) => normalize(name) === normalize(preferences.platform))) continue;
    const tags = new Set(values(game.tags).map(normalize));
    const genres = values(game.genres);
    const genreSet = new Set(genres.map(normalize));
    if (mood.avoid?.some((name) => tags.has(normalize(name)) || genreSet.has(normalize(name)))) continue;
    const reasons = [];
    let moodScore = 0;
    for (const [field, weights, actual] of [["tag", mood.tags, tags], ["genre", mood.genres, genreSet]]) {
      for (const [name, weight] of Object.entries(weights)) {
        if (!actual.has(normalize(name))) continue;
        moodScore += weight;
        reasons.push({ code: `mood-${field}`, value: name,
          text: `${field === "tag" ? "Тег" : "Жанр"} «${name}» учитывается в режиме «${mood.label}»` });
      }
    }
    // Quality and preferences cannot promote a game with no mood evidence.
    if (moodScore === 0) continue;
    let score = Math.min(60, moodScore);
    const explanations = reasons.slice(0, 3);
    const matchedGenres = genres.filter((name) => preferred.has(normalize(name)));
    score += Math.min(20, matchedGenres.length * 10);
    for (const name of matchedGenres) explanations.push({ code: "preferred-genre", value: name, text: `Предпочитаемый жанр: ${name}` });
    if (preferences.platform) explanations.push({ code: "platform", value: preferences.platform, text: `Есть на платформе ${preferences.platform}` });
    const profile = SESSION_PROFILES[game.rawgId];
    const sessionFit = { status: "not-requested", minimumMinutes: profile?.minimumMinutes ?? null,
      basis: profile?.basis ?? null, sourceUrl: profile?.sourceUrl ?? null, note: profile?.note ?? null };
    if (preferences.sessionMinutes !== null) {
      if (profile) {
        if (profile.minimumMinutes > preferences.sessionMinutes) continue;
        score += 10;
        sessionFit.status = "estimated-fit";
        explanations.push({ code: "session", value: String(profile.minimumMinutes), text: `По редакторской оценке можно запланировать сессию от ${profile.minimumMinutes} минут` });
      } else {
        if (!preferences.includeUnknownSession) { unknownExcluded++; continue; }
        unknownIncluded++;
        sessionFit.status = "unknown";
        sessionFit.note = "Данных о длительности сессии нет. Средний playtime RAWG не используется как длительность партии.";
      }
    }
    if (typeof game.rating === "number" && Number.isFinite(game.rating) && game.rating >= 0 && game.rating <= 5) score += Math.round(game.rating * 2);
    ranked.push({ game, score, reasons: explanations, sessionFit });
  }
  // The score is a rule-based ranking, not a probability or a percent of enjoyment.
  ranked.sort((a, b) => b.score - a.score || a.game.id - b.game.id);
  const warnings = [];
  if (unknownIncluded) warnings.push({ code: "unknown-session-included", text: "У части подходящих игр нет оценки длительности сессии; проверьте sessionFit." });
  if (unknownExcluded) warnings.push({ code: "unknown-session-excluded", text: "Игры без оценки длительности сессии исключены строгим фильтром времени." });
  if (!ranked.length) warnings.push({ code: "no-matches", text: "В каталоге нет игр под выбранные условия. Попробуйте изменить условия подбора." });
  return { items: ranked.slice(0, preferences.limit), meta: { algorithm: "rules-v1", preferences,
    eligibleCount: ranked.length, returnedCount: Math.min(ranked.length, preferences.limit),
    session: { unknownIncluded, unknownExcluded }, warnings } };
}
