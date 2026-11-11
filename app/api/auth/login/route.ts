import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { AuthError, DUMMY_HASH, parseLogin, verifyPassword } from "@/lib/auth.mjs";
import { readJsonBody } from "@/lib/http.mjs";
import { createSession, errorResponse, json, requireSameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { email, password } = parseLogin(await readJsonBody(request, 4096));
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // Always run scrypt, even for unknown emails, so response time does not reveal registered addresses.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new AuthError("Неверная почта или пароль", 401);
    await createSession(user.id);
    return json({ user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() } });
  } catch (error) {
    return errorResponse(error, "Не удалось войти");
  }
}
