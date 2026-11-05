import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { AuthError, hashPassword, parseRegistration } from "@/lib/auth.mjs";
import { readJsonBody } from "@/lib/http.mjs";
import { createSession, errorResponse, json, requireSameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { email, password, name } = parseRegistration(await readJsonBody(request, 4096));
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new AuthError("Аккаунт с такой почтой уже есть — войдите", 409);
    const [user] = await db.insert(users).values({ email, name, passwordHash: await hashPassword(password) })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });
    // A parallel registration with the same email wins the unique constraint; report it the same way.
    if (!user) throw new AuthError("Аккаунт с такой почтой уже есть — войдите", 409);
    await createSession(user.id);
    return json({ user: { ...user, createdAt: user.createdAt.toISOString() } }, 201);
  } catch (error) {
    return errorResponse(error, "Не удалось зарегистрироваться");
  }
}
