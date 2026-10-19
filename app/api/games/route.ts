import { NextResponse } from "next/server";
import { and, asc, ilike, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { CatalogQueryError, escapeLike, parseCatalogQuery, parseCatalogFilters } from "@/lib/catalog-query.mjs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  try {
    const { page, limit, search, offset } = parseCatalogQuery(params);
    const { genre, platform, sort } = parseCatalogFilters(params);
    const filter = and(
      search ? ilike(games.title, `%${escapeLike(search)}%`) : undefined,
      genre ? sql`${games.genres} @> ${JSON.stringify([genre])}::jsonb` : undefined,
      platform ? sql`${games.platforms} @> ${JSON.stringify([platform])}::jsonb` : undefined,
    );
    const ordering = sort === "rating" ? [sql`${games.rating} DESC NULLS LAST`]
      : sort === "release-date" ? [sql`${games.releaseDate} DESC NULLS LAST`] : [];
    // A window count keeps rows and total consistent within one database snapshot.
    const rows = await db.select({
      game: games,
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
