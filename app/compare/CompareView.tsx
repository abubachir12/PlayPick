"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Search, Star, Trophy, X } from "lucide-react";
import type { Game } from "@/types/game";
import { ApiError, requestJson } from "@/lib/api-client";
import { formatCompact, formatPrice, formatRating, pluralize, releaseYear } from "@/lib/format";
import { REGIONS, regionPrice } from "@/lib/regions.mjs";
import { useRegion } from "@/lib/use-region";
import GameCover from "../components/GameCover";

type Side = "a" | "b";
type Loaded = { slug: string; game?: Game; missing?: boolean; error?: boolean };

function useGame(slug: string | null) {
  const [state, setState] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    requestJson<Game>(`/api/games/${encodeURIComponent(slug)}`)
      .then(({ data }) => !cancelled && setState({ slug, game: data }))
      .catch((error) => !cancelled && setState(
        error instanceof ApiError && error.status === 404 ? { slug, missing: true } : { slug, error: true }));
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return slug && state?.slug === slug ? state : null;
}

// Search field with suggestions; picking a game puts it into its slot.
function GamePicker({ onPick, exclude, autoFocus }: { onPick: (slug: string) => void; exclude?: string | null; autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; games: Game[] } | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ search: trimmed, limit: "6", sort: "rating" });
      requestJson<Game[]>(`/api/games?${params}`)
        .then(({ data }) => !cancelled && setResults({ query: trimmed, games: data }))
        .catch(() => !cancelled && setResults({ query: trimmed, games: [] }));
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const games = trimmed.length >= 2 && results?.query === trimmed ? results.games.filter((game) => game.slug !== exclude) : null;

  return (
    <div className="compare-picker">
      <label className="compare-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          maxLength={200}
          placeholder="Название игры, например Witcher"
          aria-label="Найти игру для сравнения"
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {trimmed.length >= 2 && (
        <ul className="compare-results">
          {!games && <li className="compare-hint">Ищем…</li>}
          {games?.length === 0 && <li className="compare-hint">Ничего не нашлось по «{trimmed}»</li>}
          {games?.map((game) => (
            <li key={game.id}>
              <button type="button" onClick={() => onPick(game.slug)}>
                <GameCover src={game.coverUrl} title={game.title} className="search-result-cover" eager />
                <span className="search-result-text">
                  <strong>{game.title}</strong>
                  <span>{[releaseYear(game.releaseDate), game.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Quick picks for the empty slot: well-rated games of the same genre as the chosen one.
function Suggestions({ game, onPick }: { game: Game; onPick: (slug: string) => void }) {
  const genre = game.genres?.[0];
  const [state, setState] = useState<{ genre: string; games: Game[] } | null>(null);
  useEffect(() => {
    if (!genre) return;
    let cancelled = false;
    const params = new URLSearchParams({ genre, sort: "rating", limit: "6" });
    requestJson<Game[]>(`/api/games?${params}`)
      .then(({ data }) => !cancelled && setState({ genre, games: data }))
      .catch(() => !cancelled && setState({ genre, games: [] }));
    return () => {
      cancelled = true;
    };
  }, [genre]);
  const games = state && state.genre === genre ? state.games.filter((item) => item.id !== game.id).slice(0, 4) : [];
  if (!games.length) return null;
  return (
    <div className="compare-suggest">
      <p>Или сравни с похожей ({genre}):</p>
      <ul className="chip-list">
        {games.map((item) => (
          <li key={item.id}>
            <button type="button" className="chip chip-toggle" onClick={() => onPick(item.slug)}>{item.title}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Slot({ side, slug, loaded, other, onPick, onClear }: {
  side: Side; slug: string | null; loaded: Loaded | null; other: Game | undefined;
  onPick: (slug: string) => void; onClear: () => void;
}) {
  const label = side === "a" ? "Первая игра" : "Вторая игра";
  if (!slug || loaded?.missing || loaded?.error) {
    return (
      <section className="compare-slot is-empty" aria-label={label}>
        <span className="compare-slot-label">{label}</span>
        {loaded?.missing && <p className="compare-hint">Игра по ссылке не найдена — выбери другую.</p>}
        {loaded?.error && <p className="compare-hint">Не удалось загрузить игру — попробуй ещё раз.</p>}
        <GamePicker onPick={onPick} exclude={other?.slug} autoFocus={side === "b" && Boolean(other)} />
        {other && <Suggestions game={other} onPick={onPick} />}
      </section>
    );
  }
  if (!loaded?.game) return <section className="compare-slot skeleton" aria-busy="true" aria-label={label} />;
  const game = loaded.game;
  const rating = formatRating(game.rating);
  return (
    <section className="compare-slot" aria-label={label}>
      {game.coverUrl && <div className="compare-slot-backdrop" style={{ backgroundImage: `url(${JSON.stringify(game.coverUrl)})` }} />}
      <button type="button" className="compare-clear" onClick={onClear} aria-label={`Убрать ${game.title} из сравнения`}>
        <X size={16} />
      </button>
      <GameCover src={game.coverUrl} title={game.title} className="compare-cover" eager />
      <div className="compare-slot-info">
        <span className="compare-slot-label">{label}</span>
        <h2><Link href={`/games/${encodeURIComponent(game.slug)}`}>{game.title}</Link></h2>
        <p>
          {[releaseYear(game.releaseDate), game.developer].filter(Boolean).join(" · ")}
          {rating && <> · <Star size={13} fill="currentColor" /> {rating}</>}
        </p>
      </div>
    </section>
  );
}

type Row = {
  label: string;
  a: ReactNode;
  b: ReactNode;
  /** Which side wins this row, if the row has a better value at all. */
  winner?: Side | null;
};

// Higher (or lower) number wins; equal or missing values give no winner.
function pickWinner(a: number | null | undefined, b: number | null | undefined, better: "higher" | "lower"): Side | null {
  if (a == null || b == null || a === b) return null;
  return (better === "higher" ? a > b : a < b) ? "a" : "b";
}

function buildRows(a: Game, b: Game, region: string): Row[] {
  const regionLabel = REGIONS.find((item) => item.id === region)?.label ?? "";
  const price = (game: Game) => {
    const label = formatPrice(game, region);
    if (!label) return <span className="compare-none">не продаётся</span>;
    return <>{label.discount && <span className="price-table-discount">−{label.discount}%</span>}{label.label}</>;
  };
  const priceValue = (game: Game) => (game.isFree ? 0 : regionPrice(game, region)?.final ?? null);
  const yesNo = (value?: boolean | null) => value == null ? <span className="compare-none">нет данных</span> : value ? "Есть" : "Нет";
  const commonGenres = new Set((a.genres ?? []).filter((genre) => b.genres?.includes(genre)));
  const genres = (game: Game) => game.genres?.length
    ? <span className="compare-genres">{game.genres.slice(0, 4).map((genre) => (
      <span key={genre} className={commonGenres.has(genre) ? "is-common" : undefined}>{genre}</span>
    ))}</span>
    : <span className="compare-none">—</span>;
  // PC first: it is where every price on this page comes from.
  const platforms = (game: Game) => game.platforms?.length
    ? [...game.platforms].sort((x, y) => Number(y === "PC") - Number(x === "PC")).slice(0, 5).join(", ") : null;
  const number = (value: string | null, suffix = "") => value ? <>{value}{suffix && <span className="compare-unit"> {suffix}</span>}</> : <span className="compare-none">—</span>;

  return [
    { label: `Цена (${regionLabel})`, a: price(a), b: price(b), winner: pickWinner(priceValue(a), priceValue(b), "lower") },
    { label: "Оценка игроков", a: number(formatRating(a.rating), "/ 5"), b: number(formatRating(b.rating), "/ 5"),
      winner: pickWinner(a.rating && a.rating > 0 ? Math.round(a.rating * 10) : null, b.rating && b.rating > 0 ? Math.round(b.rating * 10) : null, "higher") },
    { label: "Metacritic", a: number(a.metacritic ? String(a.metacritic) : null, "/ 100"), b: number(b.metacritic ? String(b.metacritic) : null, "/ 100"),
      winner: pickWinner(a.metacritic, b.metacritic, "higher") },
    { label: "Сейчас играют в Steam", a: number(formatCompact(a.playersNow)), b: number(formatCompact(b.playersNow)),
      winner: pickWinner(a.playersNow || null, b.playersNow || null, "higher") },
    { label: "Русский язык", a: yesNo(a.hasRussian), b: yesNo(b.hasRussian),
      winner: a.hasRussian != null && b.hasRussian != null && a.hasRussian !== b.hasRussian ? (a.hasRussian ? "a" : "b") : null },
    { label: "В среднем играют", a: number(a.playtime ? String(a.playtime) : null, "ч"), b: number(b.playtime ? String(b.playtime) : null, "ч") },
    { label: "Год выхода", a: number(releaseYear(a.releaseDate)), b: number(releaseYear(b.releaseDate)) },
    { label: "Жанры", a: genres(a), b: genres(b) },
    { label: "Платформы", a: number(platforms(a)), b: number(platforms(b)) },
    { label: "Разработчик", a: number(a.developer ?? null), b: number(b.developer ?? null) },
  ];
}

function Verdict({ a, b, rows }: { a: Game; b: Game; rows: Row[] }) {
  const scored = rows.filter((row) => row.winner !== undefined);
  const winsA = scored.filter((row) => row.winner === "a").length;
  const winsB = scored.filter((row) => row.winner === "b").length;
  const leader = winsA === winsB ? null : winsA > winsB ? a : b;
  const leaderWins = Math.max(winsA, winsB);
  const decided = winsA + winsB;
  return (
    <div className="compare-verdict">
      <Trophy size={22} aria-hidden="true" />
      <p>
        {leader
          ? <><strong>{leader.title}</strong> впереди: лучше по {leaderWins} из {decided} {decided === 1 ? "параметра" : "параметров"}, где есть победитель.</>
          : decided ? <>Ничья: у каждой игры по {winsA} {pluralize(winsA, "сильной стороне", "сильные стороны", "сильных сторон")}. Решай по жанру и настроению.</>
            : <>По цифрам игры не различить — смотри жанры и описание.</>}
      </p>
    </div>
  );
}

export default function CompareView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const region = useRegion();
  const slugA = params.get("a");
  const slugB = params.get("b");
  const loadedA = useGame(slugA);
  const loadedB = useGame(slugB);

  function update(side: Side, slug: string | null) {
    const next = new URLSearchParams(params.toString());
    if (slug) next.set(side, slug);
    else next.delete(side);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const a = loadedA?.game;
  const b = loadedB?.game;
  const rows = a && b ? buildRows(a, b, region) : null;

  return (
    <>
      <div className="compare-slots">
        <Slot side="a" slug={slugA} loaded={loadedA} other={b} onPick={(slug) => update("a", slug)} onClear={() => update("a", null)} />
        <span className="compare-vs" aria-hidden="true">VS</span>
        <Slot side="b" slug={slugB} loaded={loadedB} other={a} onPick={(slug) => update("b", slug)} onClear={() => update("b", null)} />
      </div>

      {a && b && rows ? (
        <section className="compare-result" aria-label="Сравнение">
          <Verdict a={a} b={b} rows={rows} />
          <table className="compare-table">
            <thead>
              <tr>
                <th scope="col"><span className="visually-hidden">Параметр</span></th>
                <th scope="col">{a.title}</th>
                <th scope="col">{b.title}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {(["a", "b"] as const).map((side) => (
                    <td key={side} className={row.winner === side ? "is-winner" : undefined}>
                      <span className="compare-cell">
                        {row[side]}
                        {row.winner === side && <Check size={15} aria-label="лучше" />}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Цены — Steam в выбранном регионе. Общие жанры подсвечены. Длительность — средняя по игрокам RAWG.</p>
        </section>
      ) : (
        <p className="compare-empty-hint">
          {a || b ? "Выбери вторую игру — таблица появится сразу." : "Выбери две игры: найди по названию или нажми «Сравнить» на странице любой игры."}
        </p>
      )}
    </>
  );
}
