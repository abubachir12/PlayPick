import type { LlmMessage } from "@/lib/consultant.mjs";
import { ConsultantError } from "@/lib/consultant.mjs";

// Any OpenAI-compatible Chat Completions endpoint works: OpenRouter (default), Groq, Mistral, Gemini's compatibility API.
// Configure with AI_API_KEY, AI_MODEL and optionally AI_BASE_URL; the key never leaves the server.
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 25_000;

export function llmConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
}

export async function chatCompletion(messages: LlmMessage[], options: { maxTokens: number; temperature?: number }) {
  if (!llmConfigured()) throw new ConsultantError("ИИ-консультант ещё не подключён", 503);
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
      body: JSON.stringify({
        model: process.env.AI_MODEL,
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.6,
      }),
    });
  } catch {
    throw new ConsultantError("Консультант не ответил вовремя — попробуйте ещё раз", 504);
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) throw new ConsultantError("Бесплатный лимит ИИ на сейчас исчерпан — попробуйте через минуту", 429);
  if (!response.ok) {
    // Provider error bodies may echo request details; log the status only.
    console.error("LLM provider error", response.status);
    throw new ConsultantError("ИИ-сервис временно недоступен", 502);
  }
  const data = await response.json().catch(() => null) as { choices?: { message?: { content?: unknown } }[] } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new ConsultantError("ИИ вернул пустой ответ — попробуйте переформулировать", 502);
  return content;
}
