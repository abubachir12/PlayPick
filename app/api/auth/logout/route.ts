import { destroySession, errorResponse, json, requireSameOrigin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await destroySession();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Не удалось выйти");
  }
}
