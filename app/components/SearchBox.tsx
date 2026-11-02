"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import type { Game } from "@/types/game";
import { requestJson } from "@/lib/api-client";
import { formatRating, releaseYear } from "@/lib/format";
import GameCover from "./GameCover";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 220;

type Results = { query: string; games: Game[]; total: number } | null;

// Header search with live suggestions; Enter without a highlighted game opens the full catalog search.
export default function SearchBox({ className = "", autoFocusShortcut = false, onNavigate }: {
  className?: string;
  autoFocusShortcut?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: trimmed, limit: "6", sort: "rating" });
      requestJson<Game[]>(`/api/games?${params}`)
        .then(({ data, headers }) => {
          if (cancelled) return;
          setResults({ query: trimmed, games: data, total: Number(headers.get("X-Total-Count")) || data.length });
          setActive(-1);
        })
        .catch(() => !cancelled && setResults({ query: trimmed, games: [], total: 0 }));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  // "/" focuses the search from anywhere, like on GitHub or YouTube.
  useEffect(() => {
    if (!autoFocusShortcut) return;
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]");
      if (event.key !== "/" || typing || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autoFocusShortcut]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  const visible = trimmed.length >= MIN_QUERY && results?.query === trimmed ? results : null;
  const games = visible?.games ?? [];
  const showPanel = open && trimmed.length >= MIN_QUERY;

  function finish() {
    setOpen(false);
    setQuery("");
    setResults(null);
    inputRef.current?.blur();
    onNavigate?.();
  }

  function openCatalog() {
    router.push(`/games?${new URLSearchParams({ search: trimmed })}`);
    finish();
  }

  return (
    <form
      ref={boxRef}
      className={`search-wrapper search-box ${className}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (active >= 0 && games[active]) {
          router.push(`/games/${encodeURIComponent(games[active].slug)}`);
          finish();
        } else if (trimmed) {
          openCatalog();
        }
      }}
    >
      <Search size={16} className="search-icon" />
      <input
        ref={inputRef}
        className="search"
        type="search"
        value={query}
        maxLength={200}
        placeholder="Поиск игр..."
        aria-label="Поиск игр"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          } else if (event.key === "ArrowDown" && games.length) {
            event.preventDefault();
            setActive((index) => (index + 1) % games.length);
          } else if (event.key === "ArrowUp" && games.length) {
            event.preventDefault();
            setActive((index) => (index <= 0 ? games.length - 1 : index - 1));
          }
        }}
      />
      {autoFocusShortcut && !query && <kbd className="search-kbd" aria-hidden="true">/</kbd>}

      {showPanel && (
        <div className="search-panel">
          {!visible && <p className="search-hint">Ищем…</p>}
          {visible && games.length === 0 && (
            <p className="search-hint">
              Ничего не нашлось по «{trimmed}»
              {/[а-яё]/i.test(trimmed) && <><br />Названия игр на английском — попробуй, например, «Witcher».</>}
            </p>
          )}
          {games.length > 0 && (
            <ul id={listId} role="listbox" aria-label="Подсказки">
              {games.map((game, index) => {
                const rating = formatRating(game.rating);
                return (
                  <li key={game.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
                    <Link
                      href={`/games/${encodeURIComponent(game.slug)}`}
                      className={`search-result ${index === active ? "is-active" : ""}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={finish}
                    >
                      <GameCover src={game.coverUrl} title={game.title} className="search-result-cover" eager />
                      <span className="search-result-text">
                        <strong>{game.title}</strong>
                        <span>{[releaseYear(game.releaseDate), game.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</span>
                      </span>
                      {rating && <span className="search-result-rating"><Star size={12} fill="currentColor" /> {rating}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {visible && visible.total > 0 && (
            <button type="button" className="search-all" onClick={openCatalog}>
              Все результаты ({visible.total}) →
            </button>
          )}
        </div>
      )}
    </form>
  );
}
