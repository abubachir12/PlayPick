// Steam price regions the catalog tracks. The first one is the main region: its price lives in the
// price_* columns and drives sorting, discounts and price collections; the others are stored in games.prices.
export const REGIONS = [
  { id: "us", label: "США", currency: "USD" },
  { id: "kz", label: "Казахстан", currency: "KZT" },
  { id: "ru", label: "Россия", currency: "RUB" },
  { id: "ua", label: "Украина", currency: "UAH" },
  { id: "by", label: "Беларусь", currency: "USD" },
];
export const MAIN_REGION = REGIONS[0].id;
export const EXTRA_REGIONS = REGIONS.slice(1).map((region) => region.id);
export const REGION_IDS = REGIONS.map((region) => region.id);

// Price of a game in a region as { final, initial, discount, currency } or null when it is not sold there.
export function regionPrice(game, region) {
  if (region === MAIN_REGION || !REGION_IDS.includes(region)) {
    return game?.priceFinal > 0 && game.priceCurrency
      ? { final: game.priceFinal, initial: game.priceInitial ?? game.priceFinal, discount: game.discountPercent ?? 0, currency: game.priceCurrency }
      : null;
  }
  const price = game?.prices?.[region];
  return price && price.final > 0 && typeof price.currency === "string" ? price : null;
}

// Compact form kept in games.prices: only what the page shows.
export function compactPrice(price) {
  return price && price.priceFinal > 0 && price.priceCurrency
    ? { final: price.priceFinal, initial: price.priceInitial ?? price.priceFinal, discount: price.discountPercent ?? 0, currency: price.priceCurrency }
    : null;
}
