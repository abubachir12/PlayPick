import { open, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { createIgdbClient, IgdbError, parseCollectorArgs } from "../lib/igdb.mjs";

try {
  const { output, limit, offset } = parseCollectorArgs(process.argv.slice(2));
  dotenv.config({ path: ".env.local", quiet: true });
  const client = createIgdbClient({
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  });
  const records = await client.getGames({ limit, offset });
  if (!records.length) {
    console.log("IGDB не вернул игр. Файл не создан.");
  } else {
    const target = resolve(output);
    await mkdir(dirname(target), { recursive: true });
    // Exclusive creation prevents replacing previously downloaded data.
    const file = await open(target, "wx");
    try { await file.writeFile(`${JSON.stringify(records, null, 2)}\n`); }
    finally { await file.close(); }
    console.log(`Получено игр: ${records.length}. Файл: ${target}`);
    console.log("Следующий шаг: проверьте файл командой import:games с --dry-run.");
  }
} catch (error) {
  if (error instanceof IgdbError) console.error(error.message);
  else if (error?.code === "EEXIST") console.error("Файл уже существует. Укажите новое имя файла.");
  else console.error("Не удалось сохранить данные IGDB.");
  process.exitCode = 1;
}
