"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import type { Game } from "@/types/game";
import { ApiError, errorMessage, requestJson } from "@/lib/api-client";
import { formatRating, formatReleaseDate, releaseYear } from "@/lib/format";
import GameCard from "../../components/GameCard";
import GameCover from "../../components/GameCover";
import { FavoriteButton, PlayedButton } from "../../components/LibraryButtons";
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
    { label: "Год выхода", value: releaseYear(game.releaseDate), suffix: "" },
  ].filter((stat) => stat.value);

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

function ExternalLinks({ game }: { game: Game }) {
  const query = encodeURIComponent(game.title);
  const links = [
    // Local slugs come from RAWG, so the RAWG page exists only for RAWG-imported games.
    game.rawgId ? { href: `https://rawg.io/games/${encodeURIComponent(game.slug)}`, label: "Страница на RAWG" } : null,
    { href: `https://store.steampowered.com/search/?term=${query}`, label: "Найти в Steam" },
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

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 700;
  return (
    <div className="detail-block">
      <h2>Об игре</h2>
      {/* Plain text from RAWG description_raw: never render it as HTML. */}
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
              <span>/ 5 · оценка игроков RAWG</span>
            </p>
          )}

          <div className="game-hero-actions">
            <FavoriteButton game={game} withLabel />
            <PlayedButton game={game} />
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
