// Fills storefront data for catalog games from Steam: price (RU region), players online, screenshots,
// trailer, system requirements, Russian language flag and a Russian description.
// RAWG games are linked to Steam by normalized title first, so they get the same data.
// Usage: node scripts/enrich-steam.mjs            collect into data/steam-enrich.json (resumable, DB read-only)
//        node scripts/enrich-steam.mjs --apply    write the collected file to the database in one statement
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { createSteamClient, extractStorefront, SteamError, titleKey } from "../lib/steam.mjs";

const FILE = resolve("data/steam-enrich.json");
const apply = process.argv.includes("--apply");

async function readCache() {
  try { return JSON.parse(await readFile(FILE, "utf8")); } catch (error) { if (error.code === "ENOENT") return {}; throw error; }
}

try {
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  if (!process.env.DATABASE_URL) throw new SteamError("DATABASE_URL не задан");
  const sql = neon(process.env.DATABASE_URL);
  const cache = await readCache();

  if (apply) {
    const rows = Object.values(cache).filter((row) => !row.skipped);
    if (!rows.length) throw new SteamError("Нет собранных данных: сначала запустите без --apply");
    // One statement: all rows are updated or none. steam_id is only filled in, never replaced.
    const result = await sql.query(`
      UPDATE games AS g SET
        steam_id = COALESCE(g.steam_id, s."steamId"),
        is_free = s."isFree", price_final = s."priceFinal", price_initial = s."priceInitial",
        discount_percent = s."discountPercent", price_currency = s."priceCurrency",
        players_now = s."playersNow", screenshots = s.screenshots, trailer = s.trailer,
        requirements = s.requirements, has_russian = s."hasRussian",
        description = COALESCE(s.description, g.description),
        market_updated_at = now(), updated_at = now()
      FROM jsonb_to_recordset($1::jsonb) AS s(id integer, "steamId" integer, "isFree" boolean, "priceFinal" integer,
        "priceInitial" integer, "discountPercent" integer, "priceCurrency" text, "playersNow" integer,
        screenshots jsonb, trailer jsonb, requirements text, "hasRussian" boolean, description text)
      WHERE g.id = s.id
        AND NOT EXISTS (SELECT 1 FROM games other WHERE other.steam_id = s."steamId" AND other.id <> g.id)
      RETURNING g.id
    `, [JSON.stringify(rows)]);
    console.log(`Обновлено игр: ${result.length} из ${rows.length}`);
  } else {
    const games = await sql.query("SELECT id, title, steam_id, rawg_id FROM games ORDER BY id");
    const steam = createSteamClient();
    const taken = new Set(games.map((game) => game.steam_id).filter((id) => id != null));

    let done = 0;
    for (const game of games) {
      // Finished games are kept; skipped ones get another try on the next run.
      if (cache[game.id] && !cache[game.id].skipped) continue;
      let steamId = game.steam_id;
      if (steamId == null) {
        // RAWG game: look for its Steam twin by title in the store search (re-releases count as the same game).
        const key = titleKey(game.title);
        const twin = (await steam.search(game.title)).find((item) => titleKey(item.name) === key && !taken.has(item.appid));
        if (!twin) { cache[game.id] = { id: game.id, skipped: "нет пары в Steam" }; continue; }
        steamId = twin.appid;
      }
      // Games withdrawn from the Russian store have no page for that region at all: take the media and text
      // from another region and leave the price empty ("not sold here").
      let store = await steam.storeDetails(steamId, "ru");
      const soldHere = Boolean(store);
      if (!store) store = await steam.storeDetails(steamId, "us");
      if (!store || store.type !== "game") { cache[game.id] = { id: game.id, skipped: "нет карточки в магазине" }; continue; }
      taken.add(steamId);
      const data = extractStorefront(store);
      if (!soldHere) Object.assign(data, { priceFinal: null, priceInitial: null, discountPercent: null, priceCurrency: null });
      // Imported Steam games always take the fuller Russian text; RAWG games only a real Russian one.
      const russian = data.description && /[а-яё]/i.test(data.description) && data.description.length >= 200;
      cache[game.id] = { id: game.id, steamId, title: game.title, ...data,
        description: game.rawg_id == null || russian ? data.description : null,
        playersNow: (await steam.playersNow([steamId])).get(steamId) ?? null };
      if (++done % 25 === 0) {
        await mkdir(resolve("data"), { recursive: true });
        await writeFile(FILE, `${JSON.stringify(cache)}\n`);
        console.log(`  ${done} игр обработано, последняя: ${game.title}`);
      }
    }
    await mkdir(resolve("data"), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(cache)}\n`);
    const rows = Object.values(cache);
    console.log(`Готово: с данными ${rows.filter((row) => !row.skipped).length}, без пары ${rows.filter((row) => row.skipped).length}.`);
    console.log("Запишите в базу: node scripts/enrich-steam.mjs --apply");
  }
} catch (error) {
  if (error instanceof SteamError) console.error(error.message);
  else if (error?.name === "NeonDbError" || error?.cause) console.error("Ошибка базы данных.");
  else console.error(error instanceof Error ? error.message : "Не удалось обогатить каталог.");
  process.exitCode = 1;
}
