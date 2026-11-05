import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { rankRecommendations, readRecommendationRequest, RecommendationError } from "@/lib/recommendations.mjs";

export async function POST(request: Request) {
  try {
    const preferences = await readRecommendationRequest(request);
    const catalog = await db.select().from(games);
    return NextResponse.json(rankRecommendations(catalog, preferences), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RecommendationError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Ошибка подбора игр");
    return NextResponse.json({ error: "Не удалось подобрать игры" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
