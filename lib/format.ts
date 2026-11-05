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

export function formatCount(count: number) {
  return new Intl.NumberFormat("ru-RU").format(count);
}
