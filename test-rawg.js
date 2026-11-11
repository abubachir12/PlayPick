async function main() {
  const { default: dotenv } = await import("dotenv");
  const { createRawgClient } = await import("./lib/rawg.mjs");
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
  const games = await createRawgClient({ apiKey: process.env.RAWG_API_KEY })
    .getGames({ search: "Elden Ring", limit: 1 });
  console.log(games.length ? games.map(({ title, rawgId, releaseDate }) => ({ title, rawgId, releaseDate })) : "Игры не найдены");
}

main().catch(async (error) => {
  const { RawgError } = await import("./lib/rawg.mjs");
  console.error(error instanceof RawgError ? error.message : "Проверка RAWG не выполнена");
  process.exitCode = 1;
});
