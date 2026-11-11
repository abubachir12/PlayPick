import { NextResponse } from "next/server";
import { and, asc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { CatalogQueryError, escapeLike, parseCatalogQuery, parseCatalogFilters, parseMarketFilters } from "@/lib/catalog-query.mjs";
import { COLLECTION_IDS, findCollection } from "@/lib/collections.mjs";
import { expandSearch } from "@/lib/search-aliases.mjs";
import { cardColumns, catalogOrdering, collectionConditions } from "@/lib/game-columns";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const { page, limit, search, offset } = parseCatalogQuery(params);
    const { genre, platform, sort } = parseCatalogFilters(params);
    const market = parseMarketFilters(params, COLLECTION_IDS);
    const collection = market.collection ? findCollection(market.collection) : null;
    // "ведьмак" also searches "witcher": titles are stored in English.
    const terms = expandSearch(search);
    const filter = and(
      terms.length ? or(...terms.map((term) => ilike(games.title, `%${escapeLike(term)}%`))) : undefined,
      genre ? sql`${games.genres} @> ${JSON.stringify([genre])}::jsonb` : undefined,
      platform ? sql`${games.platforms} @> ${JSON.stringify([platform])}::jsonb` : undefined,
      market.deal ? sql`${games.discountPercent} > 0` : undefined,
      market.free ? sql`${games.isFree} IS TRUE` : undefined,
      market.russian ? sql`${games.hasRussian} IS TRUE` : undefined,
      ...(collection ? collectionConditions(collection) : []),
    );
    // A collection brings its own order unless the request names one.
    const ordering = catalogOrdering(collection && !params.has("sort") ? collection.sort : sort);
    // A window count keeps rows and total consistent within one database snapshot.
    const rows = await db.select({
      game: cardColumns,
      total: sql<number>`count(*) over()`.mapWith(Number),
    }).from(games).where(filter).orderBy(...ordering, asc(games.title), asc(games.id))
      .limit(limit).offset(offset);

    let total = rows[0]?.total;
    if (total === undefined) {
      const [count] = await db.select({ total: sql<number>`count(*)`.mapWith(Number) })
        .from(games).where(filter);
      total = count.total;
    }
    // Preserve the array response already agreed with the frontend.
    return NextResponse.json(rows.map((row) => row.game), {
      headers: {
        "Cache-Control": "no-store",
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Total-Pages": String(Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    if (error instanceof CatalogQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Ошибка получения игр");

    return NextResponse.json(
      { error: "Не удалось получить список игр" },
      { status: 500 }
    );
  }
}
