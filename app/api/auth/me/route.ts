import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { AuthError } from "@/lib/auth.mjs";
import { readJsonBody } from "@/lib/http.mjs";
import { destroySession, errorResponse, getCurrentUser, json, requireSameOrigin, requireUser } from "@/lib/session";

export async function GET() {
  try {
    return json({ user: await getCurrentUser() });
  } catch (error) {
    return errorResponse(error, "Не удалось проверить вход");
  }
}

// Rename the account.
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await readJsonBody(request, 1024) as { name?: unknown };
    const name = typeof body?.name === "string" ? body.name.normalize("NFKC").replace(/\s+/g, " ").trim() : "";
    if (!name || name.length > 40) throw new AuthError("Имя: от 1 до 40 символов");
    await db.update(users).set({ name }).where(eq(users.id, user.id));
    return json({ user: { ...user, name } });
  } catch (error) {
    return errorResponse(error, "Не удалось сохранить имя");
  }
}

// Delete the account; sessions and lists go with it through ON DELETE CASCADE.
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    await destroySession();
    await db.delete(users).where(eq(users.id, user.id));
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Не удалось удалить аккаунт");
  }
}
