// Shared JSON body reader for POST routes: checks Content-Type and a byte limit while streaming.
export class RequestBodyError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function readJsonBody(request, max = 8192) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestBodyError("Требуется Content-Type: application/json", 415);
  }
  if (Number(request.headers.get("content-length")) > max) throw new RequestBodyError(`JSON не должен превышать ${max} байт`, 413);
  if (!request.body) throw new RequestBodyError("Тело запроса отсутствует");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new RequestBodyError(`JSON не должен превышать ${max} байт`, 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Не удалось прочитать JSON");
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new RequestBodyError("Некорректный JSON"); }
}
