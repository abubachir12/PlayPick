import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { validateGameImport } from "../lib/import-games.mjs";
import { createImportQuery } from "../lib/import-query.mjs";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");

try {
  if (!file || args.some((arg) => arg.startsWith("--") && arg !== "--dry-run") || args.filter((arg) => !arg.startsWith("--")).length !== 1) {
    throw new Error("Использование: npm run import:games -- <файл.json> [--dry-run]");
  }
  const records = validateGameImport(JSON.parse(await readFile(file, "utf8")));
  if (dryRun) {
    console.log(`Проверено игр: ${records.length}. База данных не изменена.`);
  } else {
    dotenv.config({ path: [".env.local", ".env"], quiet: true });
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан");
    const sql = neon(process.env.DATABASE_URL);
    // One SQL statement: the entire batch succeeds or is rolled back.
    const result = await createImportQuery(sql, records);
    console.log(`Сохранено игр: ${result.length}`);
  }
} catch (error) {
  // Never print database errors or connection strings to terminal logs.
  if (error?.code === "23505") {
    console.error("Импорт отменён: внешний ID или slug занят другой игрой. Проверьте соответствие записей; вся партия отменена.");
  } else if (error?.name === "NeonDbError" || error?.cause) {
    console.error("Импорт отменён: ошибка подключения или записи в базу данных.");
  } else {
    console.error(error instanceof Error ? error.message : "Импорт отменён");
  }
  process.exitCode = 1;
}
