import { MAIN_REGION, regionPrice, type RegionPrice } from "@/lib/regions.mjs";

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

export type Priced = { isFree?: boolean | null; priceFinal?: number | null; priceInitial?: number | null;
  discountPercent?: number | null; priceCurrency?: string | null; prices?: Record<string, RegionPrice | null> | null };

export const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", KZT: "₸", RUB: "₽", UAH: "₴", EUR: "€" };

// "$14.99" for dollars; tenge, roubles and hryvnias are shown whole with their sign, as the store does.
export function formatMoney(minor: number, currency: string) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  if (currency === "USD" || currency === "EUR") {
    const amount = minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
    return `${symbol}${amount}`;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(minor / 100)} ${symbol}`;
}

// Price label for cards and the game page in the chosen region; null when the game is not sold there.
export function formatPrice(game: Priced, region: string = MAIN_REGION) {
  if (game.isFree) return { label: "Бесплатно", old: null, discount: null };
  const price = regionPrice(game, region);
  if (!price) return null;
  const discount = price.discount > 0 ? price.discount : null;
  return {
    label: formatMoney(price.final, price.currency),
    old: discount && price.initial > price.final ? formatMoney(price.initial, price.currency) : null,
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
