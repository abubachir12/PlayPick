import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: "Некорректный slug игры" }, { status: 400 });
  }
  try {
    const [game] = await db.select().from(games).where(eq(games.slug, slug)).limit(1);
    if (!game) {
      return NextResponse.json({ error: "Игра не найдена" }, { status: 404 });
    }
    return NextResponse.json(game, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Ошибка получения игры");
    return NextResponse.json({ error: "Не удалось получить игру" }, { status: 500 });
  }
}
