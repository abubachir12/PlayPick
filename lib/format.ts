export function releaseYear(date?: string | null) {
  return date && /^\d{4}/.test(date) ? date.slice(0, 4) : null;
}

export function formatReleaseDate(date?: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // releaseDate has no time zone: format it as a calendar date, not a moment in time.
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatRating(rating?: number | null) {
  return typeof rating === "number" && rating > 0 ? rating.toFixed(1) : null;
}

export function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

type Priced = { isFree?: boolean | null; priceFinal?: number | null; priceInitial?: number | null;
  discountPercent?: number | null; priceCurrency?: string | null };

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

// Price label for cards and the game page; null when the store gave no price for the region.
export function formatPrice(game: Priced) {
  if (game.isFree) return { label: "Бесплатно", old: null, discount: null };
  if (!game.priceFinal || !game.priceCurrency) return null;
  const discount = game.discountPercent && game.discountPercent > 0 ? game.discountPercent : null;
  return {
    label: money(game.priceFinal, game.priceCurrency),
    old: discount && game.priceInitial && game.priceInitial > game.priceFinal ? money(game.priceInitial, game.priceCurrency) : null,
    discount,
  };
}

// 1 234 567 → "1,2 млн", 45 300 → "45 тыс."
export function formatCompact(count?: number | null) {
  if (typeof count !== "number" || count <= 0) return null;
  return new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function formatCount(count: number) {
  return new Intl.NumberFormat("ru-RU").format(count);
}
