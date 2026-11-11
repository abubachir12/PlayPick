// Personal lists live only in the browser: there is no auth yet, so nothing is sent to the server.
export const LIBRARY_KEY = "playpick:library:v1";
export const LIBRARY_LISTS = ["favorites", "played"];
// /api/recommendations accepts up to 100 excludeIds, so "played" never grows beyond that.
export const LIST_LIMIT = 100;

export function emptyLibrary() {
  return { favorites: [], played: [] };
}

const optionalText = (value) => typeof value === "string" && value.length <= 2000 ? value : null;

// Keep only the fields cards need; anything else in storage is ignored.
export function toLibraryGame(game) {
  if (!game || typeof game !== "object") return null;
  if (!Number.isSafeInteger(game.id) || game.id < 1) return null;
  if (typeof game.slug !== "string" || !game.slug || typeof game.title !== "string" || !game.title) return null;
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    coverUrl: optionalText(game.coverUrl),
    releaseDate: optionalText(game.releaseDate),
    genres: Array.isArray(game.genres) ? game.genres.filter((name) => typeof name === "string").slice(0, 10) : [],
    rating: typeof game.rating === "number" && Number.isFinite(game.rating) ? game.rating : null,
  };
}

function cleanList(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const list = [];
  for (const item of input) {
    const game = toLibraryGame(item);
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    list.push(game);
    if (list.length === LIST_LIMIT) break;
  }
  return list;
}

export function parseLibrary(raw) {
  if (typeof raw !== "string" || !raw) return emptyLibrary();
  let data;
  try { data = JSON.parse(raw); } catch { return emptyLibrary(); }
  if (!data || typeof data !== "object") return emptyLibrary();
  return { favorites: cleanList(data.favorites), played: cleanList(data.played) };
}

export function hasGame(library, list, id) {
  return library[list].some((game) => game.id === id);
}

export function toggleGame(library, list, game) {
  if (!LIBRARY_LISTS.includes(list)) throw new Error(`Unknown library list: ${list}`);
  if (hasGame(library, list, game.id)) {
    return { ...library, [list]: library[list].filter((item) => item.id !== game.id) };
  }
  const snapshot = toLibraryGame(game);
  if (!snapshot) return library;
  return { ...library, [list]: [snapshot, ...library[list]].slice(0, LIST_LIMIT) };
}

export function clearList(library, list) {
  return { ...library, [list]: [] };
}
