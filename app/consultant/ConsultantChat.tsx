"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, RotateCcw, Send, Sparkles } from "lucide-react";
import type { Game } from "@/types/game";
import { errorMessage, requestJson } from "@/lib/api-client";
import { readLibrary } from "@/lib/use-library";
import GameCard from "../components/GameCard";

type Turn = { role: "user" | "assistant"; content: string; games?: Game[] };

const examples = [
  "Хочу что-нибудь уютное на вечер после работы",
  "Посоветуй игру с открытым миром, похожую на Skyrim",
  "Во что бесплатно поиграть с другом на ПК?",
  "Короткая игра с сильным сюжетом, часов на 5",
];

const GREETING: Turn = {
  role: "assistant",
  content: "Привет! Я консультант PlayPick. Расскажи, какое у тебя настроение, сколько времени и что нравится — подберу игры из нашего каталога.",
};

export default function ConsultantChat() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestJson<{ enabled: boolean }>("/api/consultant")
      .then(({ data }) => setEnabled(data.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  // Free models can take half a minute; say so instead of looking frozen.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...turns, { role: "user" as const, content }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const { data } = await requestJson<{ reply: string; games: Game[] }>("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The greeting is UI only; the model sees the real conversation.
          messages: next.filter((turn) => turn !== GREETING).map(({ role, content: body }) => ({ role, content: body })),
          likedIds: readLibrary().favorites.map((game) => game.id).slice(0, 100),
        }),
      }, "Консультант сейчас недоступен");
      setTurns([...next, { role: "assistant", content: data.reply, games: data.games }]);
    } catch (sendError) {
      setError(errorMessage(sendError));
      setTurns(turns);
      setDraft(content);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (enabled === false) {
    return (
      <div className="state-box">
        <Bot size={28} />
        <p className="state-title">Консультант пока не подключён</p>
        <p>Администратору нужно указать ключ ИИ-сервиса (AI_API_KEY и AI_MODEL). А пока попробуй обычный подбор по настроению.</p>
        <div className="center-row"><Link href="/pick" className="primary-button small">Подбор по настроению</Link></div>
      </div>
    );
  }

  return (
    <section className="chat">
      <div className="chat-log" aria-live="polite">
        {turns.map((turn, index) => (
          <div key={index} className={`chat-turn ${turn.role}`}>
            {turn.role === "assistant" && <span className="chat-avatar" aria-hidden="true"><Sparkles size={16} /></span>}
            <div className="chat-body">
              <p className="chat-bubble">{turn.content}</p>
              {turn.games && turn.games.length > 0 && (
                <div className="game-grid chat-games">
                  {turn.games.map((game) => <GameCard key={game.id} game={game} />)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="chat-turn assistant">
            <span className="chat-avatar" aria-hidden="true"><Sparkles size={16} /></span>
            <div className="chat-body">
              <p className="chat-bubble chat-typing" aria-label="Консультант печатает"><span /><span /><span /></p>
              {slow && <p className="hint">Бесплатный ИИ думает дольше обычного — обычно до минуты…</p>}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {turns.length === 1 && (
        <div className="chat-examples">
          {examples.map((example) => (
            <button key={example} type="button" className="chip chip-toggle" disabled={!enabled} onClick={() => void send(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <form className="chat-form" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
        <label className="visually-hidden" htmlFor="chat-input">Сообщение консультанту</label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={draft}
          rows={2}
          maxLength={1500}
          placeholder={enabled === null ? "Подключаемся…" : "Например: хочу кооператив на двоих, но без хоррора"}
          disabled={!enabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <div className="chat-actions">
          {turns.length > 1 && (
            <button type="button" className="text-link" onClick={() => { setTurns([GREETING]); setError(null); }}>
              <RotateCcw size={14} /> Начать заново
            </button>
          )}
          <button type="submit" className="primary-button small" disabled={!enabled || busy || !draft.trim()}>
            <Send size={15} /> Отправить
          </button>
        </div>
      </form>
      <p className="hint chat-note">Консультант советует только игры из каталога PlayPick. ИИ может ошибаться в деталях — проверяй страницу игры.</p>
    </section>
  );
}
