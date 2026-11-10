import { connection, NextResponse } from "next/server";
import { and, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { COLLECTIONS } from "@/lib/collections.mjs";
import { catalogOrdering, collectionConditions } from "@/lib/game-columns";

// Every collection with its size and the covers of its first games (for the tile artwork).
export async function GET() {
  // Counts and covers change with the catalog and with daily prices: always answer from the database.
  await connection();
  try {
    const result = await Promise.all(COLLECTIONS.map(async (collection) => {
      const rows = await db.select({
        title: games.title,
        coverUrl: games.coverUrl,
        total: sql<number>`count(*) over()`.mapWith(Number),
      }).from(games).where(and(...collectionConditions(collection)))
        .orderBy(...catalogOrdering(collection.sort), asc(games.title)).limit(4);
      return {
        id: collection.id, title: collection.title, text: collection.text,
        total: rows[0]?.total ?? 0,
        covers: rows.map((row) => row.coverUrl).filter(Boolean),
        example: rows[0]?.title ?? null,
      };
    }));
    // Empty collections (for example, no discounts today) are not offered.
    return NextResponse.json(result.filter((collection) => collection.total > 0), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Ошибка получения подборок");
    return NextResponse.json({ error: "Не удалось получить подборки" }, { status: 500 });
  }
}
