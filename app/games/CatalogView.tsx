"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Game } from "@/types/game";
import { errorMessage, requestJson } from "@/lib/api-client";
import { formatCount, pluralize } from "@/lib/format";
import Dropdown from "../components/Dropdown";
import GameCard from "../components/GameCard";
import { RegionSelect } from "../components/PriceTag";
import { EmptyState, ErrorState, GridSkeleton } from "../components/States";

const PAGE_SIZE = 20;
const sorts = [
  { value: "title", label: "По названию" },
  { value: "rating", label: "По рейтингу" },
  { value: "release-date", label: "Сначала новые" },
  { value: "popular", label: "Сейчас играют" },
  { value: "discount", label: "По размеру скидки" },
  { value: "price", label: "Сначала дешёвые" },
];
const flags = [
  { name: "deal", label: "Со скидкой" },
  { name: "free", label: "Бесплатные" },
  { name: "russian", label: "С русским языком" },
] as const;

type Filters = { genres: string[]; platforms: string[] };
type CatalogPage = { games: Game[]; total: number; totalPages: number };

const SORTS = new Set(sorts.map((option) => option.value));

// A hand-edited URL must not turn into an API error: invalid page and sort values fall back to defaults.
function readParams(params: URLSearchParams, defaultSort: string) {
  const rawPage = params.get("page") ?? "";
  const rawSort = params.get("sort") ?? "";
  return {
    search: params.get("search")?.trim() ?? "",
    genre: params.get("genre")?.trim() ?? "",
    platform: params.get("platform")?.trim() ?? "",
    sort: SORTS.has(rawSort) ? rawSort : defaultSort,
    deal: params.get("deal") === "1",
    free: params.get("free") === "1",
    russian: params.get("russian") === "1",
    page: /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1,
  };
}

function apiQuery({ search, genre, platform, sort, page, deal, free, russian }: ReturnType<typeof readParams>, collection?: string) {
  const query = new URLSearchParams();
  if (search) query.set("search", search.slice(0, 200));
  if (genre) query.set("genre", genre.slice(0, 200));
  if (platform) query.set("platform", platform.slice(0, 200));
  // Inside a collection the sort is always explicit: without it the API applies the collection's own order.
  if (sort !== "title" || collection) query.set("sort", sort);
  if (collection) query.set("collection", collection);
  if (deal) query.set("deal", "1");
  if (free) query.set("free", "1");
  if (russian) query.set("russian", "1");
  if (page > 1) query.set("page", String(page));
  query.set("limit", String(PAGE_SIZE));
  return query.toString();
}

// collection: show one ready-made collection (its rule is applied by the API) with the same filters on top.
export default function CatalogView({ collection, defaultSort = "title" }: { collection?: string; defaultSort?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = readParams(params, defaultSort);
  const queryKey = apiQuery(current, collection);
  const { search, genre, platform, sort, page } = current;

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
      if (value && !(name === "sort" && value === defaultSort)) next.set(name, value);
      else next.delete(name);
    }
    if (resetPage) next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: !resetPage });
  }, [params, pathname, router, defaultSort]);

  const loading = !result || result.key !== queryKey;
  const data = !loading ? result.data : undefined;
  const hasFilters = Boolean(search || genre || platform || current.deal || current.free || current.russian);
  const reset = { search: "", genre: "", platform: "", deal: "", free: "", russian: "" };

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

        <div className="field">
          <Dropdown
            label="Жанр"
            value={genre}
            onChange={(value) => update({ genre: value })}
            options={[{ value: "", label: "Все жанры" }, ...(filters?.genres ?? []).map((name) => ({ value: name, label: name }))]}
          />
        </div>

        <div className="field">
          <Dropdown
            label="Платформа"
            value={platform}
            onChange={(value) => update({ platform: value })}
            options={[{ value: "", label: "Все платформы" }, ...(filters?.platforms ?? []).map((name) => ({ value: name, label: name }))]}
          />
        </div>

        <div className="field">
          <Dropdown label="Сортировка" value={sort} onChange={(value) => update({ sort: value })} options={sorts} />
        </div>

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

      <div className="genre-strip flag-strip" aria-label="Дополнительные фильтры">
        {flags.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            className={`chip chip-toggle ${current[name] ? "is-selected" : ""}`}
            aria-pressed={current[name]}
            onClick={() => update({ [name]: current[name] ? "" : "1" })}
          >
            {label}
          </button>
        ))}
        <RegionSelect />
      </div>

      {data && (
        <p className="results-count" aria-live="polite">
          {data.total
            ? `${formatCount(data.total)} ${pluralize(data.total, "игра", "игры", "игр")}`
            : null}
          {data.total > 0 && hasFilters && (
            <button type="button" className="text-link reset-link" onClick={() => {
              setSearchDraft("");
              update(reset);
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

      {data && data.games.length === 0 && data.total > 0 && (
        <EmptyState title="Такой страницы нет">
          <p>В каталоге {data.totalPages} {pluralize(data.totalPages, "страница", "страницы", "страниц")}.</p>
          <button type="button" className="secondary-button small" onClick={() => update({ page: "" }, false)}>
            На первую страницу
          </button>
        </EmptyState>
      )}

      {data && data.total === 0 && (
        <EmptyState title={hasFilters || collection ? "Ничего не нашлось" : "Каталог пока пуст"}>
          {/[а-яё]/i.test(search) && (
            <p>Названия в каталоге английские. Популярные русские названия мы понимаем («ведьмак», «сталкер»), для остальных попробуй оригинальное.</p>
          )}
          {!hasFilters && collection && <p>Сегодня в этой подборке пусто — загляни позже.</p>}
          {hasFilters ? (
            <button type="button" className="secondary-button small" onClick={() => {
              setSearchDraft("");
              update(reset);
            }}>
              Сбросить фильтры
            </button>
          ) : !collection && (
            <p>Игры ещё не загружены. Загляни чуть позже.</p>
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
