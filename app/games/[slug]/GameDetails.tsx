"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import type { Game } from "@/types/game";
import { ApiError, errorMessage, requestJson } from "@/lib/api-client";
import { formatCompact, formatPrice, formatRating, formatReleaseDate, releaseYear } from "@/lib/format";
import { REGIONS } from "@/lib/regions.mjs";
import { useRegion } from "@/lib/use-region";
import { RegionSelect } from "../../components/PriceTag";
import GameMedia from "./GameMedia";
import GameCard from "../../components/GameCard";
import GameCover from "../../components/GameCover";
import { FavoriteButton, PlayedButton } from "../../components/LibraryButtons";
import ShareButton from "../../components/ShareButton";
import { EmptyState, ErrorState } from "../../components/States";

export function GameDetailsSkeleton() {
  return (
    <div className="game-hero" aria-busy="true" aria-label="Загрузка">
      <div className="game-cover skeleton game-hero-cover" />
      <div className="game-hero-info">
        <div className="skeleton skeleton-line wide" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}

function Similar({ game }: { game: Game }) {
  const [games, setGames] = useState<Game[]>([]);
  const genre = game.genres?.[0];

  useEffect(() => {
    if (!genre) return;
    let cancelled = false;
    const query = new URLSearchParams({ genre, sort: "rating", limit: "5" });
    requestJson<Game[]>(`/api/games?${query}`)
      .then(({ data }) => !cancelled && setGames(data.filter((item) => item.id !== game.id).slice(0, 4)))
      .catch(() => !cancelled && setGames([]));
    return () => {
      cancelled = true;
    };
  }, [genre, game.id]);

  if (!genre || games.length === 0) return null;

  return (
    <section className="page-section compact">
      <div className="section-heading">
        <h2>Ещё {genre}</h2>
        <Link href={`/games?genre=${encodeURIComponent(genre)}`} className="text-link">Смотреть все</Link>
      </div>
      <div className="game-grid">
        {games.map((item) => <GameCard key={item.id} game={item} />)}
      </div>
    </section>
  );
}

function Stats({ game }: { game: Game }) {
  const stats = [
    { label: "Оценка игроков", value: formatRating(game.rating), suffix: "/ 5" },
    { label: "Metacritic", value: game.metacritic ? String(game.metacritic) : null, suffix: "/ 100" },
    // RAWG playtime is an average across players, not a guaranteed completion time.
    { label: "В среднем играют", value: game.playtime ? String(game.playtime) : null, suffix: "ч" },
    { label: "Сейчас играют в Steam", value: formatCompact(game.playersNow), suffix: "" },
    { label: "Год выхода", value: releaseYear(game.releaseDate), suffix: "" },
  ].filter((stat) => stat.value).slice(0, 4);

  if (!stats.length) return null;
  return (
    <dl className="stat-strip">
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}{stat.suffix && <span> {stat.suffix}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function PriceBlock({ game }: { game: Game }) {
  const region = useRegion();
  if (!game.steamId) return null;
  const price = formatPrice(game, region);
  const store = `https://store.steampowered.com/app/${game.steamId}/`;
  const current = REGIONS.find((item) => item.id === region) ?? REGIONS[0];
  const updated = game.marketUpdatedAt
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(new Date(game.marketUpdatedAt)) : null;
  // Every tracked region side by side: the cheapest place to buy is visible at a glance.
  const rows = game.isFree ? [] : REGIONS.map((item) => ({ ...item, price: formatPrice(game, item.id) }));

  return (
    <div className="price-block">
      <div className="price-head">
        <h2>Цена в Steam</h2>
        <RegionSelect />
      </div>
      {price ? (
        <p className="price-line">
          {price.discount && <span className="price-discount">−{price.discount}%</span>}
          <strong>{price.label}</strong>
          {price.old && <s>{price.old}</s>}
        </p>
      ) : (
        <p className="price-missing">В регионе «{current.label}» игра не продаётся.</p>
      )}
      <a href={store} target="_blank" rel="noopener noreferrer" className={`${price ? "primary-button" : "secondary-button"} small`}>
        {game.isFree ? "Играть в Steam" : price ? "Купить в Steam" : "Страница в Steam"} <ExternalLink size={14} />
      </a>
      {rows.some((row) => row.price) && (
        <table className="price-table">
          <caption className="visually-hidden">Цены в других регионах</caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.id === region ? "is-current" : undefined}>
                <th scope="row">{row.label}</th>
                <td>
                  {row.price ? (
                    <>
                      {row.price.discount && <span className="price-table-discount">−{row.price.discount}%</span>}
                      {row.price.label}
                    </>
                  ) : <span className="price-table-none">не продаётся</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {updated && <p className="hint">Цены Steam, обновлено {updated}.</p>}
    </div>
  );
}
function ExternalLinks({ game }: { game: Game }) {
  const query = encodeURIComponent(game.title);
  const links = [
    // Local slugs come from RAWG, so the RAWG page exists only for RAWG-imported games.
    game.rawgId ? { href: `https://rawg.io/games/${encodeURIComponent(game.slug)}`, label: "Страница на RAWG" } : null,
    game.steamId
      ? { href: `https://store.steampowered.com/app/${game.steamId}/`, label: "Страница в Steam" }
      : { href: `https://store.steampowered.com/search/?term=${query}`, label: "Найти в Steam" },
    { href: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.title} trailer`)}`, label: "Трейлеры на YouTube" },
    { href: `https://www.metacritic.com/search/${query}/`, label: "Обзоры на Metacritic" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div className="detail-block">
      <h2>Ссылки</h2>
      <ul className="link-list">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label} <ExternalLink size={14} />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Description({ text: raw }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Older catalog texts carry leftover heading marks ("###Setting"); the page shows plain paragraphs.
  const text = raw.replace(/^\s*#{1,6}\s*/gm, "");
  const long = text.length > 700;
  return (
    <div className="detail-block">
      <h2>Об игре</h2>
      {/* Plain text (RAWG description_raw or stripped Steam text): never render it as HTML. */}
      <p className={`game-description ${long && !expanded ? "is-clamped" : ""}`}>{text}</p>
      {long && (
        <button type="button" className="text-link" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Свернуть" : "Читать полностью"}
        </button>
      )}
    </div>
  );
}

function Facts({ game }: { game: Game }) {
  const facts = [
    ["Выход", formatReleaseDate(game.releaseDate)],
    ["Разработчик", game.developer],
    ["Издатель", game.publisher],
    ["Платформы", game.platforms?.join(", ")],
    ["Русский язык", game.hasRussian == null ? null : game.hasRussian ? "Есть" : "Нет"],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));

  if (!facts.length) return null;
  return (
    <dl className="facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function GameDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [state, setState] = useState<{ slug: string; game?: Game; error?: string; missing?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    requestJson<Game>(`/api/games/${encodeURIComponent(slug)}`, undefined, "Не удалось загрузить игру")
      .then(({ data }) => !cancelled && setState({ slug, game: data }))
      .catch((error) => {
        if (cancelled) return;
        setState(error instanceof ApiError && error.status === 404 ? { slug, missing: true } : { slug, error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  if (!state || state.slug !== slug) return <GameDetailsSkeleton />;

  if (state.missing) {
    return (
      <EmptyState title="Игра не найдена">
        <title>Игра не найдена — PlayPick</title>
        <p>Возможно, ссылка устарела или игру ещё не добавили в каталог.</p>
        <Link href="/games" className="secondary-button small">В каталог</Link>
      </EmptyState>
    );
  }

  if (!state.game) {
    return <ErrorState message={state.error ?? "Не удалось загрузить игру"} onRetry={() => setAttempt((value) => value + 1)} />;
  }

  const game = state.game;
  const rating = formatRating(game.rating);
  const subtitle = [releaseYear(game.releaseDate), game.developer].filter(Boolean).join(" · ");

  return (
    <>
      <title>{`${game.title} — PlayPick`}</title>
      <nav className="breadcrumbs" aria-label="Навигация">
        <Link href="/games" className="back-link"><ArrowLeft size={16} /> Каталог</Link>
        {game.genres?.[0] && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/games?genre=${encodeURIComponent(game.genres[0])}`}>{game.genres[0]}</Link>
          </>
        )}
      </nav>

      <section className="game-hero">
        {game.coverUrl && (
          <div className="game-hero-backdrop" style={{ backgroundImage: `url(${JSON.stringify(game.coverUrl)})` }} />
        )}
        <GameCover src={game.coverUrl} title={game.title} className="game-hero-cover" />

        <div className="game-hero-info">
          {subtitle && <p className="game-hero-subtitle">{subtitle}</p>}
          <h1>{game.title}</h1>

          {rating && (
            <p className="game-hero-rating">
              <Star size={18} fill="currentColor" /> {rating}
              <span>/ 5 · {game.steamId && !game.rawgId ? "по отзывам в Steam" : "оценка игроков RAWG"}</span>
            </p>
          )}

          <div className="game-hero-actions">
            <FavoriteButton game={game} withLabel />
            <PlayedButton game={game} />
            <ShareButton title={`${game.title} — PlayPick`} />
          </div>
        </div>
      </section>

      <Stats game={game} />

      <div className="game-body">
        <div className="game-body-main">
          {game.description ? (
            <Description text={game.description} />
          ) : (
            <p className="game-description muted">Описания пока нет.</p>
          )}

          <GameMedia game={game} />

          {game.requirements && (
            <div className="detail-block">
              <h2>Минимальные системные требования</h2>
              <p className="requirements">{game.requirements}</p>
            </div>
          )}

          {game.tags && game.tags.length > 0 && (
            <div className="detail-block">
              <h2>Теги</h2>
              <ul className="tag-list">
                {game.tags.slice(0, 24).map((name) => <li key={name}>#{name}</li>)}
              </ul>
            </div>
          )}
        </div>

        <aside className="game-body-side">
          <PriceBlock game={game} />
          {game.genres && game.genres.length > 0 && (
            <div className="detail-block">
              <h2>Жанры</h2>
              <ul className="chip-list">
                {game.genres.map((name) => (
                  <li key={name}>
                    <Link className="chip chip-link" href={`/games?genre=${encodeURIComponent(name)}`}>{name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Facts game={game} />
          <ExternalLinks game={game} />
        </aside>
      </div>

      <Similar game={game} />
    </>
  );
}
