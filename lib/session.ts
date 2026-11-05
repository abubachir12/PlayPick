import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import { AuthError, hashToken, isSameOrigin, newSessionToken, SESSION_COOKIE, SESSION_DAYS, sessionExpiry } from "@/lib/auth.mjs";
import { RequestBodyError } from "@/lib/http.mjs";

export type SessionUser = { id: number; email: string; name: string; createdAt: string };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function createSession(userId: number) {
  const token = newSessionToken();
  // Expired rows of this user are cleaned up whenever they sign in again.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt: sessionExpiry() });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await db.select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Нужно войти в аккаунт", 401);
  return user;
}

export function requireSameOrigin(request: Request) {
  if (!isSameOrigin(request)) throw new AuthError("Запрос отклонён: другой источник", 403);
}

const noStore = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

// Known validation errors become their status; anything else is logged and hidden behind a safe 500.
export function errorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError || error instanceof RequestBodyError) return json({ error: error.message }, error.status);
  console.error(fallback, error instanceof Error ? error.message : "");
  return json({ error: fallback }, 500);
}
