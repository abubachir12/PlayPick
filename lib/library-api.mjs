import { LIBRARY_LISTS, LIST_LIMIT } from "./library-store.mjs";

export class LibraryRequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const isId = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

function ids(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > LIST_LIMIT || !value.every(isId)) {
    throw new LibraryRequestError(`${name}: массив до ${LIST_LIMIT} ID игр`);
  }
  return [...new Set(value)];
}

// POST /api/library body: {action:"add"|"remove", list, gameId}, {action:"clear", list}
// or {action:"merge", favorites, played}.
export function parseLibraryChange(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new LibraryRequestError("Требуется JSON-объект");
  if (input.action === "merge") {
    if (Object.keys(input).some((key) => !["action", "favorites", "played"].includes(key))) {
      throw new LibraryRequestError("Неизвестное поле в запросе");
    }
    return { action: "merge", favorites: ids(input.favorites, "favorites"), played: ids(input.played, "played") };
  }
  if (input.action === "clear") {
    if (Object.keys(input).some((key) => !["action", "list"].includes(key))) throw new LibraryRequestError("Неизвестное поле в запросе");
    if (!LIBRARY_LISTS.includes(input.list)) throw new LibraryRequestError("list: favorites или played");
    return { action: "clear", list: input.list };
  }
  if (input.action === "add" || input.action === "remove") {
    if (Object.keys(input).some((key) => !["action", "list", "gameId"].includes(key))) {
      throw new LibraryRequestError("Неизвестное поле в запросе");
    }
    if (!LIBRARY_LISTS.includes(input.list)) throw new LibraryRequestError("list: favorites или played");
    if (!isId(input.gameId)) throw new LibraryRequestError("gameId: локальный ID игры");
    return { action: input.action, list: input.list, gameId: input.gameId };
  }
  throw new LibraryRequestError("action: add, remove, clear или merge");
}
