import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { games, userGames } from "@/db/schema";
import { readJsonBody } from "@/lib/http.mjs";
import { LibraryRequestError, parseLibraryChange } from "@/lib/library-api.mjs";
import { LIST_LIMIT } from "@/lib/library-store.mjs";
import { errorResponse, json, requireSameOrigin, requireUser } from "@/lib/session";

async function loadLibrary(userId: number) {
  const rows = await db.select({
    list: userGames.list,
    id: games.id,
    slug: games.slug,
    title: games.title,
    coverUrl: games.coverUrl,
    releaseDate: games.releaseDate,
    genres: games.genres,
    rating: games.rating,
  }).from(userGames).innerJoin(games, eq(games.id, userGames.gameId))
    .where(eq(userGames.userId, userId)).orderBy(desc(userGames.createdAt));
  const pick = (list: string) => rows.filter((row) => row.list === list).map((row) => ({
    id: row.id, slug: row.slug, title: row.title, coverUrl: row.coverUrl,
    releaseDate: row.releaseDate, genres: row.genres ?? [], rating: row.rating,
  }));
  return { favorites: pick("favorites"), played: pick("played") };
}

async function listSize(userId: number, list: string) {
  const [row] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(userGames)
    .where(and(eq(userGames.userId, userId), eq(userGames.list, list)));
  return row?.n ?? 0;
}

export async function GET() {
  try {
    const user = await requireUser();
    return json(await loadLibrary(user.id));
  } catch (error) {
    return errorResponse(error, "Не удалось загрузить библиотеку");
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const change = parseLibraryChange(await readJsonBody(request, 8192));
    if (change.action === "merge") {
      // Games picked before signing in join the account; unknown IDs are dropped by the join with games.
      const wanted = [
        ...change.favorites.map((gameId) => ({ gameId, list: "favorites" })),
        ...change.played.map((gameId) => ({ gameId, list: "played" })),
      ];
      const known = wanted.length
        ? new Set((await db.select({ id: games.id }).from(games).where(inArray(games.id, wanted.map((item) => item.gameId)))).map((row) => row.id))
        : new Set<number>();
      const values = wanted.filter((item) => known.has(item.gameId)).map((item) => ({ userId: user.id, ...item }));
      if (values.length) await db.insert(userGames).values(values).onConflictDoNothing();
    } else if (change.action === "add") {
      const [game] = await db.select({ id: games.id }).from(games).where(eq(games.id, change.gameId)).limit(1);
      if (!game) throw new LibraryRequestError("Игра не найдена", 404);
      if (await listSize(user.id, change.list) >= LIST_LIMIT) throw new LibraryRequestError(`В списке не больше ${LIST_LIMIT} игр`, 409);
      await db.insert(userGames).values({ userId: user.id, gameId: change.gameId, list: change.list }).onConflictDoNothing();
    } else if (change.action === "clear") {
      await db.delete(userGames).where(and(eq(userGames.userId, user.id), eq(userGames.list, change.list)));
    } else {
      await db.delete(userGames).where(and(eq(userGames.userId, user.id), eq(userGames.gameId, change.gameId),
        eq(userGames.list, change.list)));
    }
    return json(await loadLibrary(user.id));
  } catch (error) {
    if (error instanceof LibraryRequestError) return json({ error: error.message }, error.status);
    return errorResponse(error, "Не удалось сохранить библиотеку");
  }
}
