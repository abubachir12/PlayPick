// Browser helpers for the PlayPick API; errors carry the API's safe Russian message.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function requestJson<T>(url: string, init?: RequestInit, fallback = "Не удалось загрузить данные") {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error pages fall through to the generic message.
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error : fallback;
    throw new ApiError(message, response.status);
  }
  return { data: body as T, headers: response.headers };
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Что-то пошло не так. Попробуйте ещё раз.";
}
