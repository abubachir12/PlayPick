import { connection, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    // One snapshot; return only the values that are actually in the local catalog.
    const rows = await db.execute(sql`
      SELECT 'genre' AS kind, value FROM games, jsonb_array_elements_text(genres) AS value
      UNION
      SELECT 'platform' AS kind, value FROM games, jsonb_array_elements_text(platforms) AS value
      ORDER BY kind, value
    `);
    return NextResponse.json({
      genres: rows.rows.filter((row) => row.kind === "genre").map((row) => row.value),
      platforms: rows.rows.filter((row) => row.kind === "platform").map((row) => row.value),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Ошибка получения фильтров каталога");
    return NextResponse.json({ error: "Не удалось получить фильтры каталога" }, { status: 500 });
  }
}
