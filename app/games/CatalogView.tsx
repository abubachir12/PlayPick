"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Game } from "@/types/game";
import { errorMessage, requestJson } from "@/lib/api-client";
import { formatCount, pluralize } from "@/lib/format";
import GameCard from "../components/GameCard";
import { EmptyState, ErrorState, GridSkeleton } from "../components/States";

const PAGE_SIZE = 20;
const sorts = [
  { value: "title", label: "По названию" },
  { value: "rating", label: "По рейтингу" },
  { value: "release-date", label: "Сначала новые" },
];

type Filters = { genres: string[]; platforms: string[] };
type CatalogPage = { games: Game[]; total: number; totalPages: number };

// Only forward known parameters; the API rejects malformed ones with 400.
function apiQuery(params: URLSearchParams) {
  const query = new URLSearchParams();
  for (const name of ["search", "genre", "platform", "sort", "page"]) {
    const value = params.get(name)?.trim();
    if (value) query.set(name, value);
  }
  query.set("limit", String(PAGE_SIZE));
  return query.toString();
}

export default function CatalogView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryKey = apiQuery(params);

  const search = params.get("search") ?? "";
  const genre = params.get("genre") ?? "";
  const platform = params.get("platform") ?? "";
  const sort = params.get("sort") ?? "title";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [searchDraft, setSearchDraft] = useState(search);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [result, setResult] = useState<{ key: string; data?: CatalogPage; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Header search navigates here with a new query; keep the input in sync with the URL.
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setSearchDraft(search);
  }

  useEffect(() => {
    requestJson<Filters>("/api/catalog/filters").then(({ data }) => setFilters(data)).catch(() => {
      setFilters({ genres: [], platforms: [] });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestJson<Game[]>(`/api/games?${queryKey}`, undefined, "Не удалось загрузить каталог")
      .then(({ data, headers }) => {
        if (cancelled) return;
        setResult({ key: queryKey, data: {
          games: data,
          total: Number(headers.get("X-Total-Count")) || 0,
          totalPages: Number(headers.get("X-Total-Pages")) || 0,
        } });
      })
      .catch((error) => !cancelled && setResult({ key: queryKey, error: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [queryKey, attempt]);

  const update = useCallback((changes: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value && !(name === "sort" && value === "title")) next.set(name, value);
      else next.delete(name);
    }
    if (resetPage) next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: !resetPage });
  }, [params, pathname, router]);

  const loading = !result || result.key !== queryKey;
  const data = !loading ? result.data : undefined;
  const hasFilters = Boolean(search || genre || platform);

  return (
    <>
      <form
        className="filters-bar"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update({ search: searchDraft.trim() });
        }}
      >
        <label className="field field-search">
          <span className="visually-hidden">Название игры</span>
          <Search size={16} className="field-icon" />
          <input
            type="search"
            value={searchDraft}
            maxLength={200}
            placeholder="Название игры"
            onChange={(event) => setSearchDraft(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="visually-hidden">Жанр</span>
          <select value={genre} onChange={(event) => update({ genre: event.target.value })}>
            <option value="">Все жанры</option>
            {filters?.genres.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="visually-hidden">Платформа</span>
          <select value={platform} onChange={(event) => update({ platform: event.target.value })}>
            <option value="">Все платформы</option>
            {filters?.platforms.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>

        <label className="field">
          <span className="visually-hidden">Сортировка</span>
          <select value={sort} onChange={(event) => update({ sort: event.target.value })}>
            {sorts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <button type="submit" className="primary-button">Найти</button>
      </form>

      {filters && filters.genres.length > 0 && (
        <div className="genre-strip" aria-label="Быстрый выбор жанра">
          <button
            type="button"
            className={`chip chip-toggle ${genre ? "" : "is-selected"}`}
            aria-pressed={!genre}
            onClick={() => update({ genre: "" })}
          >
            Все
          </button>
          {filters.genres.map((name) => (
            <button
              key={name}
              type="button"
              className={`chip chip-toggle ${genre === name ? "is-selected" : ""}`}
              aria-pressed={genre === name}
              onClick={() => update({ genre: genre === name ? "" : name })}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {data && (
        <p className="results-count" aria-live="polite">
          {data.total
            ? `${formatCount(data.total)} ${pluralize(data.total, "игра", "игры", "игр")}`
            : null}
          {data.total > 0 && hasFilters && (
            <button type="button" className="text-link reset-link" onClick={() => {
              setSearchDraft("");
              update({ search: "", genre: "", platform: "" });
            }}>
              Сбросить фильтры
            </button>
          )}
        </p>
      )}

      {loading && <GridSkeleton />}

      {!loading && result.error && (
        <ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} />
      )}

      {data && data.games.length === 0 && (
        <EmptyState title={hasFilters ? "Ничего не нашлось" : "Каталог пока пуст"}>
          {hasFilters ? (
            <button type="button" className="secondary-button small" onClick={() => {
              setSearchDraft("");
              update({ search: "", genre: "", platform: "" });
            }}>
              Сбросить фильтры
            </button>
          ) : (
            <p>Игры добавляются командой <code>npm run import:games</code>.</p>
          )}
        </EmptyState>
      )}

      {data && data.games.length > 0 && (
        <>
          <div className="game-grid">
            {data.games.map((game) => <GameCard key={game.id} game={game} />)}
          </div>

          {data.totalPages > 1 && (
            <nav className="pagination" aria-label="Страницы каталога">
              <button
                type="button"
                className="secondary-button small"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) }, false)}
              >
                <ChevronLeft size={16} /> Назад
              </button>
              <span>Страница {page} из {data.totalPages}</span>
              <button
                type="button"
                className="secondary-button small"
                disabled={page >= data.totalPages}
                onClick={() => update({ page: String(page + 1) }, false)}
              >
                Вперёд <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
