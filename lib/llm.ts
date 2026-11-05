import type { LlmMessage } from "@/lib/consultant.mjs";
import { ConsultantError } from "@/lib/consultant.mjs";

// Any OpenAI-compatible Chat Completions endpoint works: OpenRouter (default), Groq, Mistral, Gemini's compatibility API.
// Configure with AI_API_KEY, AI_MODEL and optionally AI_BASE_URL; the key never leaves the server.
// AI_MODEL may list several models separated by commas: free models are often busy, so the next one is tried.
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 25_000;

function models() {
  return (process.env.AI_MODEL ?? "").split(",").map((model) => model.trim()).filter(Boolean);
}

export function llmConfigured() {
  return Boolean(process.env.AI_API_KEY && models().length);
}

type Attempt = { ok: true; content: string } | { ok: false; status: number; retryable: boolean; reason: string };

async function callModel(model: string, messages: LlmMessage[], options: { maxTokens: number; temperature?: number }): Promise<Attempt> {
  const base = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        // OpenRouter uses these to label the app on its dashboard; other providers ignore them.
        "HTTP-Referer": process.env.AI_APP_URL || "https://playpick-delta.vercel.app",
        "X-Title": "PlayPick",
      },
      body: JSON.stringify({ model, messages, max_tokens: options.maxTokens, temperature: options.temperature ?? 0.6 }),
    });
  } catch {
    return { ok: false, status: 504, retryable: true, reason: "timeout or network error" };
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => null) as {
    choices?: { message?: { content?: unknown } }[];
    error?: { message?: unknown };
  } | null;
  if (!response.ok) {
    // Provider messages ("Rate limit exceeded: free-models-per-day", "No endpoints found") never contain the key.
    const reason = typeof data?.error?.message === "string" ? data.error.message.slice(0, 200) : "";
    return { ok: false, status: response.status, retryable: response.status === 429 || response.status === 404 || response.status >= 500, reason };
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) return { ok: false, status: 502, retryable: true, reason: "empty answer" };
  return { ok: true, content };
}

export async function chatCompletion(messages: LlmMessage[], options: { maxTokens: number; temperature?: number }) {
  if (!llmConfigured()) throw new ConsultantError("ИИ-консультант ещё не подключён", 503);
  let last: Extract<Attempt, { ok: false }> | null = null;
  for (const model of models()) {
    const attempt = await callModel(model, messages, options);
    if (attempt.ok) return attempt.content;
    console.error("LLM provider error", model, attempt.status, attempt.reason);
    last = attempt;
    if (!attempt.retryable) break;
  }
  if (last?.status === 429 && /per-day/i.test(last.reason)) {
    throw new ConsultantError("Дневной бесплатный лимит ИИ исчерпан — консультант снова заработает завтра", 429);
  }
  if (last?.status === 429) throw new ConsultantError("Бесплатный ИИ сейчас перегружен — попробуйте через минуту", 429);
  if (last?.status === 504) throw new ConsultantError("Консультант не ответил вовремя — попробуйте ещё раз", 504);
  if (last?.status === 401 || last?.status === 403) throw new ConsultantError("Ключ ИИ-сервиса не принят — проверьте AI_API_KEY", 502);
  throw new ConsultantError("ИИ-сервис временно недоступен", 502);
}
