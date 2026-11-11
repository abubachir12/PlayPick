// Prices of one game in several PC stores (Steam, GOG, Epic, Humble...), from the free CheapShark API.
// CheapShark lists only authorized retailers and prices in US dollars, which matches PlayPick's main region.
// Its terms ask for links through its redirect, so every offer points there.

export const CHEAPSHARK_API = "https://www.cheapshark.com/api/1.0";

// Shop names as players know them (CheapShark keeps a few historical ones).
const STORE_NAMES = {
  1: "Steam", 2: "GamersGate", 3: "Green Man Gaming", 7: "GOG", 11: "Humble Store", 13: "Ubisoft Store",
  15: "Fanatical", 21: "WinGameStore", 23: "GameBillet", 24: "Voidu", 25: "Epic Games Store", 27: "Gamesplanet",
  28: "Gamesload", 29: "2Game", 30: "IndieGala", 31: "Blizzard Shop", 33: "DLGamer", 34: "Noctre", 35: "DreamGame",
};

// Stores run by the platform or the publisher itself; the rest (Humble, Fanatical, GMG...) are authorized key resellers.
export const OFFICIAL_STORES = new Set([1, 7, 13, 25, 31]);

function toCents(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

export function storeName(id, names = {}) {
  return STORE_NAMES[id] ?? names[id] ?? `Магазин ${id}`;
}

// CheapShark `games?id=` answer → offers sorted from the cheapest, one per store.
export function parseOffers(details, storeNames = {}) {
  const deals = Array.isArray(details?.deals) ? details.deals : [];
  const byStore = new Map();
  for (const deal of deals) {
    const storeId = Number(deal?.storeID);
    const price = toCents(deal?.price);
    const retail = toCents(deal?.retailPrice);
    if (!Number.isInteger(storeId) || price === null || typeof deal?.dealID !== "string" || !deal.dealID) continue;
    const initial = retail !== null && retail >= price ? retail : price;
    const offer = {
      storeId,
      store: storeName(storeId, storeNames),
      official: OFFICIAL_STORES.has(storeId),
      price,
      initial,
      discount: initial > 0 ? Math.round((1 - price / initial) * 100) : 0,
      // dealID comes URL-encoded already.
      url: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`,
    };
    const known = byStore.get(storeId);
    if (!known || offer.price < known.price) byStore.set(storeId, offer);
  }
  // Same price: the official store first, then by name, so the list does not jump between refreshes.
  const offers = [...byStore.values()].sort((a, b) =>
    a.price - b.price || Number(b.official) - Number(a.official) || a.store.localeCompare(b.store));
  const lowest = details?.cheapestPriceEver;
  const lowestPrice = toCents(lowest?.price);
  return {
    offers,
    lowestEver: lowestPrice === null ? null : {
      price: lowestPrice,
      date: Number.isFinite(Number(lowest?.date)) && Number(lowest.date) > 0
        ? new Date(Number(lowest.date) * 1000).toISOString().slice(0, 10) : null,
    },
  };
}

// CheapShark `stores` answer → { id: name } for stores that still trade.
export function parseStoreNames(stores) {
  const names = {};
  for (const store of Array.isArray(stores) ? stores : []) {
    if (store?.isActive && store?.storeID && typeof store.storeName === "string") names[Number(store.storeID)] = store.storeName;
  }
  return names;
}
