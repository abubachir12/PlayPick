import { connection, NextResponse } from "next/server";
import { isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games } from "@/db/schema";
import { createSteamClient, extractPrice } from "@/lib/steam.mjs";

// Daily refresh of the data that goes stale: Steam prices/discounts (RU region) and players online
// (store API for prices, official Steam Web API for player counts; no keys needed).
// Scheduled in vercel.json. Vercel sends "Authorization: Bearer $CRON_SECRET" when that variable is set;
// without it the route still cannot be abused, because it does nothing if the data is fresh.
export const maxDuration = 60;
const FRESH_MS = 6 * 60 * 60 * 1000;

export async function GET(request: Request) {
  // Never run during a build: this route talks to Steam and writes to the database.
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 401 });
  }
  try {
    const [{ latest }] = await db.select({ latest: sql<string | null>`max(${games.marketUpdatedAt})` }).from(games);
    if (latest && Date.now() - new Date(latest).getTime() < FRESH_MS) {
      return NextResponse.json({ refreshed: 0, reason: "Данные свежие" });
    }
    const rows = await db.select({ id: games.id, steamId: games.steamId, isFree: games.isFree })
      .from(games).where(isNotNull(games.steamId));
    // Long back-off pauses do not fit a 60-second function: cap every wait, keep the normal request pacing.
    const steam = createSteamClient({ wait: (ms) => new Promise((done) => setTimeout(done, Math.min(ms, 2000))) });
    const ids = rows.map((row) => row.steamId as number);
    // Prices are the part worth refreshing; players online are a bonus that may fail on its own.
    const prices = await steam.prices(ids);
    // Official Steam player counts; a game whose lookup fails keeps yesterday's number.
    const online = await steam.playersNow(ids, 24);

    const updates = rows.filter((row) => prices.has(row.steamId as number)).map((row) => {
      const price = extractPrice({ is_free: row.isFree === true, price_overview: prices.get(row.steamId as number) });
      return { id: row.id, priceFinal: price.priceFinal, priceInitial: price.priceInitial,
        discountPercent: price.discountPercent, priceCurrency: price.priceCurrency,
        playersNow: online.get(row.steamId as number) ?? null };
    });
    if (updates.length) {
      // One statement for the whole catalog; players_now keeps its old value when SteamSpy gave nothing.
      await db.execute(sql`
        UPDATE games AS g SET
          price_final = s."priceFinal", price_initial = s."priceInitial",
          discount_percent = s."discountPercent", price_currency = s."priceCurrency",
          players_now = COALESCE(s."playersNow", g.players_now), market_updated_at = now()
        FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS s(id integer, "priceFinal" integer,
          "priceInitial" integer, "discountPercent" integer, "priceCurrency" text, "playersNow" integer)
        WHERE g.id = s.id`);
    }
    return NextResponse.json({ refreshed: updates.length, withOnline: online.size > 0 });
  } catch (error) {
    console.error("Ошибка обновления цен", error instanceof Error ? error.message : "");
    return NextResponse.json({ error: "Не удалось обновить цены" }, { status: 502 });
  }
}
