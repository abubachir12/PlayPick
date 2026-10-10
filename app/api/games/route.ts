
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games } from "@/db/schema";

export async function GET() {
  try {
    const allGames = await db.select().from(games);

    return NextResponse.json(allGames);
  } catch (error) {
    console.error("Ошибка получения игр:", error);

    return NextResponse.json(
      { error: "Не удалось получить список игр" },
      { status: 500 }
    );
  }
}
