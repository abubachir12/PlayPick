import { getTableColumns, sql, type SQL } from "drizzle-orm";
import { games } from "@/db/schema";
import type { Collection } from "@/lib/collections.mjs";
import type { CatalogSort } from "@/lib/catalog-query.mjs";

// Lists and ranking never show the gallery, trailer or requirements; leaving them out keeps list responses small.
const { screenshots: _screenshots, trailer: _trailer, requirements: _requirements, ...cardColumns } = getTableColumns(games);
void _screenshots; void _trailer; void _requirements;
export { cardColumns };

const textArray = (values: string[]) => sql`ARRAY[${sql.join(values.map((value) => sql`${value}`), sql`, `)}]::text[]`;

// SQL form of a collection rule; lib/collections.mjs holds the same rule in plain JavaScript.
export function collectionConditions({ rule }: Collection): SQL[] {
  const conditions: SQL[] = [];
  if (rule.tagsAny) conditions.push(sql`${games.tags} ?| ${textArray(rule.tagsAny)}`);
  if (rule.tagsNone) conditions.push(sql`NOT (COALESCE(${games.tags}, '[]'::jsonb) ?| ${textArray(rule.tagsNone)})`);
  if (rule.free) {
    conditions.push(sql`(${games.isFree} IS TRUE OR (${games.isFree} IS NULL AND ${games.tags} ?| ${textArray(["Free to Play", "Free To Play"])}))`);
  }
  if (rule.deal) conditions.push(sql`${games.discountPercent} > 0`);
  if (rule.playing) conditions.push(sql`${games.playersNow} > 0`);
  if (rule.maxPrice != null) conditions.push(sql`${games.priceFinal} > 0 AND ${games.priceFinal} <= ${rule.maxPrice}`);
  if (rule.playtime) conditions.push(sql`${games.playtime} BETWEEN ${rule.playtime[0]} AND ${rule.playtime[1]}`);
  if (rule.releasedBefore) conditions.push(sql`${games.releaseDate} < ${rule.releasedBefore}`);
  if (rule.minRating != null) conditions.push(sql`${games.rating} >= ${rule.minRating}`);
  return conditions;
}

export function catalogOrdering(sort: CatalogSort): SQL[] {
  switch (sort) {
    case "rating": return [sql`${games.rating} DESC NULLS LAST`];
    case "release-date": return [sql`${games.releaseDate} DESC NULLS LAST`];
    case "popular": return [sql`${games.playersNow} DESC NULLS LAST`, sql`${games.rating} DESC NULLS LAST`];
    case "discount": return [sql`${games.discountPercent} DESC NULLS LAST`, sql`${games.rating} DESC NULLS LAST`];
    // Free games and games without a regional price go after priced ones: "cheapest" means something you can buy.
    case "price": return [sql`CASE WHEN ${games.priceFinal} > 0 THEN 0 ELSE 1 END`, sql`${games.priceFinal} ASC NULLS LAST`];
    default: return [];
  }
}
