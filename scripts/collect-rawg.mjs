import { open, mkdir, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { createRawgClient, parseRawgArgs, RawgError } from "../lib/rawg.mjs";

try {
  const { output, ...options } = parseRawgArgs(process.argv.slice(2));
  const target = resolve(output);
  let exists = false;
  try { await access(target); exists = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) throw new RawgError("Файл уже существует. Укажите новое имя файла.");
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  const records = await createRawgClient({ apiKey: process.env.RAWG_API_KEY }).getGames(options);
  if (!records.length) console.log("RAWG не вернул игр. Файл не создан.");
  else {
    await mkdir(dirname(target), { recursive: true });
    const file = await open(target, "wx");
    try { await file.writeFile(`${JSON.stringify(records, null, 2)}\n`); }
    finally { await file.close(); }
    console.log(`Получено игр: ${records.length}. Файл: ${target}`);
    console.log("Проверьте данные: npm run import:games -- <файл.json> --dry-run");
  }
} catch (error) {
  if (error instanceof RawgError) console.error(error.message);
  else if (error?.code === "EEXIST") console.error("Файл уже существует. Укажите новое имя файла.");
  else console.error("Не удалось сохранить данные RAWG.");
  process.exitCode = 1;
}
