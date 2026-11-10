import { NextResponse } from "next/server";
import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { buildAnswerMessages, buildExtractionMessages, ConsultantError, extractLocally, parseAnswer, parseChatRequest,
  parseExtraction } from "@/lib/consultant.mjs";
import { readJsonBody, RequestBodyError } from "@/lib/http.mjs";
import { chatCompletion, llmConfigured } from "@/lib/llm";
import { escapeLike } from "@/lib/catalog-query.mjs";
import { parseRecommendationPreferences, rankRecommendations } from "@/lib/recommendations.mjs";
import { isSameOrigin } from "@/lib/auth.mjs";
import { cardColumns } from "@/lib/game-columns";

const noStore = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore });

// Best-effort per-instance limit so one visitor cannot burn the free LLM quota: 8 questions per minute per IP.
const WINDOW_MS = 60_000;
const LIMIT = 8;
const hits = new Map<string, number[]>();
function rateLimited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT;
}

export async function GET() {
  return json({ enabled: llmConfigured() });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) throw new ConsultantError("Запрос отклонён: другой источник", 403);
    if (!llmConfigured()) throw new ConsultantError("ИИ-консультант ещё не подключён", 503);
    if (rateLimited(request)) throw new ConsultantError("Слишком много вопросов подряд — подождите минуту", 429);
    const { messages, likedIds } = parseChatRequest(await readJsonBody(request, 24_000));

    const catalog = await db.select(cardColumns).from(games);
    const genres = [...new Set(catalog.flatMap((game) => game.genres ?? []))].sort();
    const platforms = [...new Set(catalog.flatMap((game) => game.platforms ?? []))].sort();

    // If the model is busy for the understanding step, a keyword reading keeps the consultant answering.
    let extraction;
    try {
      extraction = parseExtraction(
        await chatCompletion(buildExtractionMessages(messages, { genres, platforms }), { maxTokens: 300, temperature: 0 }),
        { genres, platforms },
      );
    } catch (error) {
      if (!(error instanceof ConsultantError) || error.status === 503) throw error;
      extraction = extractLocally(messages, { genres, platforms });
    }

    // "Like Hollow Knight" becomes a taste signal: matched titles are treated as liked games for ranking.
    const similar = extraction.similarTo.length
      ? await db.select({ id: games.id, title: games.title }).from(games)
        .where(or(...extraction.similarTo.map((title) => ilike(games.title, `%${escapeLike(title)}%`))))
        .orderBy(sql`${games.rating} DESC NULLS LAST`).limit(3)
      : [];
    const preferences = parseRecommendationPreferences({
      mood: extraction.mood,
      limit: 8,
      ...(extraction.platform ? { platform: extraction.platform } : {}),
      ...(extraction.genres.length ? { preferredGenres: extraction.genres } : {}),
      ...(extraction.freeOnly ? { freeOnly: true } : {}),
      ...(extraction.length ? { length: extraction.length } : {}),
      likedIds: [...new Set([...similar.map((game) => game.id), ...likedIds])].slice(0, 100),
    });
    const ranked = extraction.offTopic ? { items: [] } : rankRecommendations(catalog, preferences);

    const answer = await chatCompletion(buildAnswerMessages(messages, ranked.items, extraction), { maxTokens: 700 });
    const { reply, games: picked } = parseAnswer(answer, ranked.items);
    return json({
      reply,
      games: picked,
      understood: { ...extraction, similarFound: similar.map((game) => game.title) },
    });
  } catch (error) {
    if (error instanceof ConsultantError || error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    console.error("Ошибка консультанта", error instanceof Error ? error.message : "");
    return json({ error: "Консультант сейчас недоступен" }, 500);
  }
}
