import { connection, NextResponse } from "next/server";
import { CHEAPSHARK_API, parseOffers, parseStoreNames } from "@/lib/stores.mjs";

// GET /api/offers?steamId=1091500 → the game's price in Steam, GOG, Epic, Humble and other PC stores (US dollars).
// Asked live from CheapShark and kept by the Vercel CDN for 6 hours, so one game costs two upstream requests at most.
const HEADERS = { "User-Agent": "PlayPick/1.0 (student project; game price comparison)", Accept: "application/json" };
const CACHE = "public, s-maxage=21600, stale-while-revalidate=86400";

async function cheapshark(path: string) {
  const response = await fetch(`${CHEAPSHARK_API}/${path}`, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`CheapShark ${response.status}`);
  return response.json();
}

// Store names change rarely: one lookup per server instance is enough.
let storeNames: Promise<Record<number, string>> | null = null;
function loadStoreNames() {
  storeNames ??= cheapshark("stores").then(parseStoreNames).catch(() => {
    storeNames = null;
    return {};
  });
  return storeNames;
}

export async function GET(request: Request) {
  await connection();
  const steamId = new URL(request.url).searchParams.get("steamId") ?? "";
  if (!/^\d{1,10}$/.test(steamId)) {
    return NextResponse.json({ error: "Нужен steamId" }, { status: 400 });
  }
  try {
    const found = await cheapshark(`games?steamAppID=${steamId}`);
    const gameId = Array.isArray(found) ? found[0]?.gameID : null;
    if (!gameId) {
      return NextResponse.json({ offers: [], lowestEver: null }, { headers: { "Cache-Control": CACHE } });
    }
    const [details, names] = await Promise.all([cheapshark(`games?id=${encodeURIComponent(gameId)}`), loadStoreNames()]);
    return NextResponse.json(parseOffers(details, names), { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    console.error("Ошибка получения цен магазинов", error instanceof Error ? error.message : "");
    return NextResponse.json({ error: "Цены магазинов недоступны" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
