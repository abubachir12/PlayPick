// Collects popular Steam games that are not in the catalog yet into a JSON batch for import:games.
// Usage: node scripts/collect-steam.mjs <file.json> [--limit 100] [--min-reviews 2000] [--min-positive 0.75]
// The database is only read (to skip games already present). Rejected app IDs are cached so reruns skip them.
import { access, mkdir, open, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { createSteamClient, normalizeSteamGame, pickCandidates, SteamError, titleKey } from "../lib/steam.mjs";

const REJECTED_FILE = resolve("data/steam-rejected.json");

function parseArgs(args) {
  const options = { output: null, limit: 100, minReviews: 2000, minPositive: 0.75 };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];
    if (arg === "--limit" && /^\d+$/.test(value ?? "") && Number(value) >= 1 && Number(value) <= 100) options.limit = Number(args[++i]);
    else if (arg === "--min-reviews" && /^\d+$/.test(value ?? "")) options.minReviews = Number(args[++i]);
    else if (arg === "--min-positive" && /^0?\.\d+$/.test(value ?? "")) options.minPositive = Number(args[++i]);
    else if (!arg.startsWith("-") && !options.output) options.output = arg;
    else throw new SteamError("Использование: collect-steam <файл.json> [--limit 1–100] [--min-reviews 2000] [--min-positive 0.75]");
  }
  if (!options.output?.endsWith(".json")) throw new SteamError("Укажите выходной файл .json");
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const target = resolve(options.output);
  try { await access(target); throw new SteamError("Файл уже существует. Укажите новое имя файла."); }
  catch (error) { if (error instanceof SteamError) throw error; if (error.code !== "ENOENT") throw error; }

  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  if (!process.env.DATABASE_URL) throw new SteamError("DATABASE_URL не задан: нужен, чтобы пропустить игры, которые уже есть");
  const sql = neon(process.env.DATABASE_URL);
  const existing = await sql.query("SELECT steam_id, slug, title FROM games");
  const known = {
    steamIds: new Set(existing.map((row) => row.steam_id).filter((id) => id != null)),
    titles: new Set(existing.map((row) => titleKey(row.title))),
  };
  const slugs = new Set(existing.map((row) => row.slug));
  // Batches collected earlier but not imported yet count as known too, so reruns never repeat a game.
  for (const name of (await readdir(resolve("data"))).filter((file) => /^steam-\d+\.json$/.test(file))) {
    for (const game of JSON.parse(await readFile(resolve("data", name), "utf8"))) {
      known.steamIds.add(game.steamId);
      known.titles.add(titleKey(game.title));
      slugs.add(game.slug);
    }
  }

  let rejected = {};
  try { rejected = JSON.parse(await readFile(REJECTED_FILE, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }

  const steam = createSteamClient();
  const candidates = pickCandidates(await steam.listPopular(0), { known, ...options })
    .filter((game) => !rejected[game.appid]);
  console.log(`Кандидатов в Steam, которых нет в каталоге: ${candidates.length}`);

  const records = [];
  for (const candidate of candidates) {
    if (records.length >= options.limit) break;
    const [spy, store] = [await steam.spyDetails(candidate.appid), await steam.storeDetails(candidate.appid)];
    const result = normalizeSteamGame(spy, store);
    if ("rejected" in result) {
      rejected[candidate.appid] = `${candidate.name}: ${result.rejected}`;
      console.log(`  пропуск ${candidate.name} — ${result.rejected}`);
      continue;
    }
    // Same game under a slightly different store title, or a slug another game already uses.
    if (known.titles.has(titleKey(result.title))) continue;
    if (slugs.has(result.slug)) result.slug = `${result.slug}-${result.steamId}`;
    slugs.add(result.slug);
    known.titles.add(titleKey(result.title));
    records.push(result);
    console.log(`  ${records.length}. ${result.title}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(REJECTED_FILE, `${JSON.stringify(rejected, null, 2)}\n`);
  if (!records.length) console.log("Новых игр не найдено. Файл не создан.");
  else {
    const file = await open(target, "wx");
    try { await file.writeFile(`${JSON.stringify(records, null, 2)}\n`); } finally { await file.close(); }
    console.log(`Собрано игр: ${records.length}. Файл: ${target}`);
    console.log("Проверьте данные: npm run import:games -- <файл.json> --dry-run");
  }
} catch (error) {
  if (error instanceof SteamError) console.error(error.message);
  else if (error?.name === "NeonDbError" || error?.cause) console.error("Не удалось прочитать каталог из базы данных.");
  else console.error(error instanceof Error ? error.message : "Не удалось собрать игры из Steam.");
  process.exitCode = 1;
}
