// PlayPick consultant: the language model talks, but games always come from our own catalog and ranking.
// Step 1 turns the chat into ranking preferences, step 2 is rankRecommendations, step 3 phrases the answer.

export class ConsultantError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 1500;
const MOOD_IDS = ["relax", "challenge", "story", "explore", "social"];
const LENGTH_IDS = ["short", "medium", "long"];

export function parseChatRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ConsultantError("Требуется JSON-объект");
  if (Object.keys(input).some((key) => !["messages", "likedIds"].includes(key))) throw new ConsultantError("Неизвестное поле в запросе");
  const { messages } = input;
  const likedIds = input.likedIds === undefined ? [] : input.likedIds;
  if (!Array.isArray(likedIds) || likedIds.length > 100
    || !likedIds.every((id) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647)) {
    throw new ConsultantError("likedIds: массив до 100 ID игр");
  }
  if (!Array.isArray(messages) || !messages.length) throw new ConsultantError("messages: непустой массив сообщений");
  const recent = messages.slice(-MAX_MESSAGES);
  const clean = recent.map((message) => {
    if (!message || typeof message !== "object" || !["user", "assistant"].includes(message.role)
      || typeof message.content !== "string") {
      throw new ConsultantError("Каждое сообщение: { role: user|assistant, content: string }");
    }
    const content = message.content.trim();
    if (!content) throw new ConsultantError("Пустое сообщение");
    if (content.length > MAX_MESSAGE_LENGTH) throw new ConsultantError(`Сообщение длиннее ${MAX_MESSAGE_LENGTH} символов`);
    return { role: message.role, content };
  });
  if (clean.at(-1).role !== "user") throw new ConsultantError("Последнее сообщение должно быть от пользователя");
  return { messages: clean, likedIds: [...new Set(likedIds)] };
}

function transcript(messages) {
  return messages.map((m) => `${m.role === "user" ? "Пользователь" : "Консультант"}: ${m.content}`).join("\n");
}

export function buildExtractionMessages(messages, catalog) {
  const system = [
    "Ты разбираешь запрос игрока для сервиса подбора игр PlayPick и возвращаешь ТОЛЬКО JSON без пояснений.",
    "Поля:",
    `- "mood": одно из ${MOOD_IDS.join(", ")} — ближайшее настроение (relax — спокойно и уютно, challenge — сложно и соревновательно, story — сюжет, explore — открытый мир и исследование, social — игра с друзьями). Всегда выбери одно.`,
    `- "genres": до 3 жанров ТОЛЬКО из списка: ${catalog.genres.join(", ")}.`,
    `- "platform": одна платформа ТОЛЬКО из списка или null: ${catalog.platforms.join(", ")}.`,
    '- "similarTo": до 3 названий игр, на которые игрок хочет похожее (оригинальные английские названия), иначе [].',
    '- "freeOnly": true, только если игрок прямо хочет бесплатные игры.',
    `- "length": ${LENGTH_IDS.join(", ")} или null (short — до 8 часов, long — больше 25).`,
    '- "offTopic": true, если сообщение вообще не про выбор игр.',
    'Пример: {"mood":"social","genres":["Shooter"],"platform":"PC","similarTo":[],"freeOnly":true,"length":null,"offTopic":false}',
  ].join("\n");
  return [{ role: "system", content: system }, { role: "user", content: transcript(messages) }];
}

// Models sometimes wrap JSON in prose or code fences; take the first balanced object and validate every field.
export function parseExtraction(text, catalog) {
  const fallback = { mood: "explore", genres: [], platform: null, similarTo: [], freeOnly: false, length: null, offTopic: false };
  if (typeof text !== "string") return fallback;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return fallback;
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch { return fallback; }
  if (!data || typeof data !== "object") return fallback;
  const pick = (list, value) => list.find((item) => typeof value === "string" && item.toLowerCase() === value.trim().toLowerCase()) ?? null;
  const strings = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  return {
    mood: MOOD_IDS.includes(data.mood) ? data.mood : fallback.mood,
    genres: [...new Set(strings(data.genres).map((genre) => pick(catalog.genres, genre)).filter(Boolean))].slice(0, 3),
    platform: pick(catalog.platforms, data.platform),
    similarTo: strings(data.similarTo).map((title) => title.trim()).filter((title) => title && title.length <= 120).slice(0, 3),
    freeOnly: data.freeOnly === true,
    length: LENGTH_IDS.includes(data.length) ? data.length : null,
    offTopic: data.offTopic === true,
  };
}

// Used when the model is busy: a plain keyword reading of the user's words, so the consultant still answers.
const MOOD_WORDS = {
  social: ["друг", "вместе", "кооп", "co-op", "coop", "компани", "мультиплеер", "вдвоём", "вдвоем", "двоих", "онлайн"],
  relax: ["уют", "спокой", "расслаб", "отдох", "чил", "медитат", "без напряг", "лампов"],
  challenge: ["сложн", "хардкор", "вызов", "испыта", "souls", "соулс", "рогалик", "сорев", "pvp"],
  story: ["сюжет", "истори", "нарратив", "кинематограф", "персонаж", "выбор"],
  explore: ["открыт", "исслед", "песочн", "выжив", "крафт", "космос", "мир"],
};
const GENRE_WORDS = { Shooter: ["шутер", "стрелял"], RPG: ["рпг", "rpg", "ролев"], Puzzle: ["головолом", "пазл"],
  Strategy: ["стратег"], Racing: ["гонк"], Sports: ["спорт", "футбол"], Platformer: ["платформер"], Indie: ["инди"],
  Adventure: ["приключен"], Simulation: ["симулятор"], Fighting: ["файтинг"], Action: ["экшен", "экшн"] };
const PLATFORM_WORDS = { PC: ["пк", " pc", "компьютер", "ноутбук"], "PlayStation 5": ["ps5", "плейстейшн 5"],
  "PlayStation 4": ["ps4", "плейстейшн 4"], "Nintendo Switch": ["switch", "свитч"], "Xbox Series S/X": ["xbox series"],
  "Xbox One": ["xbox one"] };
const NOT_TITLES = new Set(["pc", "ps4", "ps5", "xbox", "switch", "rpg", "pvp", "co-op", "coop", "souls", "indie"]);

export function extractLocally(messages, catalog) {
  const text = ` ${messages.filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase()} `;
  const has = (words) => words.some((word) => text.includes(word));
  const mood = Object.entries(MOOD_WORDS).find(([, words]) => has(words))?.[0] ?? "story";
  const genres = Object.entries(GENRE_WORDS).filter(([genre, words]) => catalog.genres.includes(genre) && has(words))
    .map(([genre]) => genre).slice(0, 3);
  const platform = Object.entries(PLATFORM_WORDS).find(([name, words]) => catalog.platforms.includes(name) && has(words))?.[0] ?? null;
  const hours = Number(text.match(/(\d+)\s*(?:час|ч\b)/)?.[1]);
  const length = has(["коротк"]) || (hours > 0 && hours <= 8) ? "short" : has(["длинн", "надолго"]) || hours >= 25 ? "long" : null;
  // Game titles in the catalog are English, so Latin phrases in a Russian message are likely titles.
  const lastUser = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const similarTo = (lastUser.match(/[A-Za-z][A-Za-z0-9':&.\- ]{2,40}/g) ?? [])
    .map((title) => title.trim()).filter((title) => title.length >= 3 && !NOT_TITLES.has(title.toLowerCase())).slice(0, 3);
  return { mood, genres, platform, similarTo, freeOnly: has(["бесплат", "free"]), length, offTopic: false };
}

const short = (value, max) => typeof value === "string" && value.length > max ? `${value.slice(0, max).trimEnd()}…` : (value ?? "");

export function describeCandidate(item) {
  const { game, reasons } = item;
  const year = typeof game.releaseDate === "string" ? game.releaseDate.slice(0, 4) : "?";
  const why = reasons.map((reason) => reason.text).slice(0, 4).join("; ");
  // Price facts come from our database, so the model can mention them without inventing numbers.
  const price = game.isFree ? "бесплатная"
    : game.priceFinal > 0 && game.priceCurrency === "USD"
      ? `$${(game.priceFinal / 100).toFixed(2)} в Steam (регион США)${game.discountPercent > 0 ? `, скидка ${game.discountPercent}%` : ""}` : null;
  return `[${game.id}] ${game.title} (${year}) — жанры: ${(game.genres ?? []).join(", ") || "?"}; рейтинг: ${game.rating ?? "?"}/5; `
    + `в среднем ${game.playtime || "?"} ч; ${price ? `цена: ${price}; ` : ""}${game.hasRussian ? "есть русский язык; " : ""}`
    + `почему подходит: ${why}. ${short(game.description, 220)}`;
}

export function buildAnswerMessages(messages, candidates, extraction) {
  const system = [
    "Ты — дружелюбный консультант по видеоиграм сервиса PlayPick. Отвечай по-русски, живо и по делу, без канцелярита.",
    "Пиши только русскими словами: английские слова допустимы лишь в названиях игр. Не здоровайся повторно в каждом ответе.",
    "Советуй ТОЛЬКО игры из списка кандидатов ниже — это игры из нашего каталога. Никогда не придумывай игры и факты о них.",
    "Выбери 2–4 лучших кандидата под запрос, для каждого одной-двумя фразами объясни, почему он подходит именно этому игроку.",
    "Если кандидатов нет, честно скажи, что в каталоге не нашлось подходящего, и предложи смягчить условия.",
    extraction.offTopic ? "Сообщение не про игры: вежливо ответь коротко и верни разговор к выбору игр." : "",
    "Без markdown-таблиц и без ссылок. В самом конце ответа отдельной строкой напиши ID выбранных игр в формате: ИГРЫ: 12, 45, 7",
    "",
    "Кандидаты:",
    candidates.length ? candidates.map(describeCandidate).join("\n") : "(нет подходящих игр)",
  ].filter((line) => line !== "").join("\n");
  return [{ role: "system", content: system }, ...messages];
}

// The final "ИГРЫ:" line becomes cards; only IDs we actually offered are accepted.
export function parseAnswer(text, candidates) {
  const allowed = new Map(candidates.map((item) => [item.game.id, item.game]));
  // The chat shows plain text: drop markdown emphasis and headings that models add despite the instructions.
  const raw = (typeof text === "string" ? text : "").replace(/\*\*|__/g, "").replace(/^#{1,6}\s*/gm, "");
  const match = raw.match(/(?:^|\n)[^\S\n]*(?:ИГРЫ|IDS|Игры)\s*:\s*([\d,\s]+?)\s*$/u);
  const reply = (match ? raw.slice(0, match.index) : raw).replace(/\[(\d+)\]\s*/g, "").trim();
  let ids = match ? [...new Set(match[1].split(/[,\s]+/).map(Number).filter((id) => allowed.has(id)))] : [];
  if (!ids.length) {
    // No ID line: show the offered games the text actually names, in the order it names them.
    const lower = reply.toLowerCase();
    ids = candidates.map((item) => ({ id: item.game.id, at: lower.indexOf(item.game.title.toLowerCase()) }))
      .filter((hit) => hit.at >= 0).sort((a, b) => a.at - b.at).map((hit) => hit.id);
  }
  if (!ids.length) ids = candidates.slice(0, 3).map((item) => item.game.id);
  const games = ids.map((id) => allowed.get(id)).filter(Boolean);
  return { reply: reply || "Вот что я нашёл в каталоге:", games: games.slice(0, 4) };
}
