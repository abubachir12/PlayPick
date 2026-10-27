"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Coffee,
  Compass,
  Gamepad2,
  LibraryBig,
  Monitor,
  Sparkles,
  Star,
  Sword,
  Users,
} from "lucide-react";
import type { Game } from "@/types/game";
import type { RecommendationResponse } from "@/types/recommendation";
import { requestJson } from "@/lib/api-client";
import { formatCount, formatRating, releaseYear } from "@/lib/format";
import GameCard from "./components/GameCard";
import { FavoriteButton } from "./components/LibraryButtons";
import { GridSkeleton } from "./components/States";

const heroImages = [
  "/hero/ark.jpg",
  "/hero/battlefield.jpg",
  "/hero/rust.jpg",
  "/hero/witcher.jpg",
];

// Photos from the team's hero set stand in until the catalog provides a cover for the mood.
const moods = [
  { id: "relax", label: "Расслабиться", text: "Уютные игры без спешки", icon: Coffee, photo: "/hero/rust.jpg" },
  { id: "challenge", label: "Испытать себя", text: "Сложные бои и рогалики", icon: Sword, photo: "/hero/battlefield.jpg" },
  { id: "story", label: "Погрузиться в сюжет", text: "Истории, где важен выбор", icon: BookOpen, photo: "/hero/witcher.jpg" },
  { id: "explore", label: "Исследовать мир", text: "Открытые миры и песочницы", icon: Compass, photo: "/hero/ark.jpg" },
  { id: "social", label: "Поиграть вместе", text: "Кооператив и мультиплеер", icon: Users, photo: null },
];

type Filters = { genres: string[]; platforms: string[] };

function useJson<T>(url: string) {
  const [state, setState] = useState<{ data: T; headers: Headers } | null | "error">(null);
  useEffect(() => {
    let cancelled = false;
    requestJson<T>(url)
      .then((result) => !cancelled && setState(result))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

function useMoodCovers() {
  const [covers, setCovers] = useState<Record<string, Game>>({});
  useEffect(() => {
    let cancelled = false;
    for (const mood of moods) {
      requestJson<RecommendationResponse>("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: mood.id, limit: 3 }),
      }).then(({ data }) => {
        const game = data.items.find((item) => item.game.coverUrl)?.game;
        if (!cancelled && game) setCovers((current) => ({ ...current, [mood.id]: game }));
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return covers;
}

function SectionHeading({ title, text, href, link }: { title: string; text?: string; href?: string; link?: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {href && <Link href={href} className="text-link">{link ?? "Смотреть все"} <ArrowRight size={14} /></Link>}
    </div>
  );
}

function Featured({ games }: { games: Game[] }) {
  // The best-rated game with artwork; games are already sorted by rating.
  const game = games.find((item) => item.coverUrl) ?? games[0];
  if (!game) return null;

  const rating = formatRating(game.rating);
  const meta = [releaseYear(game.releaseDate), ...(game.genres ?? []).slice(0, 3)].filter(Boolean).join(" · ");

  return (
    <section className="page-section reveal">
      <article className="featured">
        {game.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.coverUrl} alt="" className="featured-image" />
        )}
        <div className="featured-shade" />
        <div className="featured-content">
          <span className="eyebrow"><Sparkles size={14} /> Лучшая в каталоге</span>
          <h2>{game.title}</h2>
          <p className="featured-meta">
            {rating && <span className="featured-rating"><Star size={15} fill="currentColor" /> {rating}</span>}
            {meta}
          </p>
          {game.description && <p className="featured-text">{game.description}</p>}
          <div className="featured-actions">
            <Link href={`/games/${encodeURIComponent(game.slug)}`} className="primary-button">
              Подробнее <ArrowRight size={16} />
            </Link>
            <FavoriteButton game={game} withLabel />
          </div>
        </div>
      </article>
    </section>
  );
}

function GenreTiles({ games, genres }: { games: Game[]; genres: string[] }) {
  // Each genre borrows the cover of its best-rated game, skipping covers another tile already uses.
  const tiles = useMemo(() => {
    const used = new Set<string>();
    return genres.map((name) => ({ name, matches: games.filter((game) => game.genres?.includes(name)) }))
      .filter((genre) => genre.matches.length > 0)
      .sort((a, b) => b.matches.length - a.matches.length)
      .slice(0, 8)
      .map(({ name, matches }) => {
        const withCover = matches.filter((game) => game.coverUrl);
        const pick = withCover.find((game) => !used.has(game.coverUrl!)) ?? withCover[0] ?? matches[0];
        if (pick?.coverUrl) used.add(pick.coverUrl);
        return { name, cover: pick?.coverUrl ?? null, top: pick?.title };
      });
  }, [games, genres]);

  if (!tiles.length) return null;
  return (
    <section className="page-section reveal">
      <SectionHeading title="Жанры" text="Начни с любимого — каталог отфильтруется сам." href="/games" link="Весь каталог" />
      <div className="genre-grid">
        {tiles.map((tile) => (
          <Link key={tile.name} href={`/games?genre=${encodeURIComponent(tile.name)}`} className="genre-tile">
            {tile.cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tile.cover} alt="" loading="lazy" />
            )}
            <span className="genre-tile-shade" />
            <strong>{tile.name}</strong>
            {tile.top && <span>например, {tile.top}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [currentImage, setCurrentImage] = useState(0);
  const top = useJson<Game[]>("/api/games?sort=rating&limit=8");
  const fresh = useJson<Game[]>("/api/games?sort=release-date&limit=4");
  const sample = useJson<Game[]>("/api/games?sort=rating&limit=100");
  const filters = useJson<Filters>("/api/catalog/filters");
  const moodCovers = useMoodCovers();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentImage]);

  const ready = <T,>(state: { data: T } | null | "error") => state && state !== "error" ? state.data : null;
  const total = sample && sample !== "error" ? Number(sample.headers.get("X-Total-Count")) || 0 : undefined;
  const filterData = ready(filters);
  const value = (count?: number) => count === undefined ? "—" : formatCount(count);
  const topGames = ready(top);
  const freshGames = ready(fresh);
  const sampleGames = ready(sample);

  return (
    <main className="home">
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentImage}
          src={heroImages[currentImage]}
          alt=""
          className="hero-image"
        />

        <div className="hero-overlay"></div>

        <div className="hero-content">
          <h1 className="hero-title">
            Во что поиграть
            <span>сейчас?</span>
          </h1>

          <p className="hero-description">
            Подберём игры под твоё настроение, время
            и то, что тебе нравится.
          </p>

          <div className="hero-buttons">
            <Link href="/pick" className="primary-button">
              Подобрать игру →
            </Link>

            <Link href="/games" className="secondary-button">
              Открыть каталог
            </Link>
          </div>

          <div className="hero-dots" role="tablist" aria-label="Фоновые изображения">
            {heroImages.map((image, index) => (
              <button
                key={image}
                type="button"
                role="tab"
                aria-selected={index === currentImage}
                aria-label={`Изображение ${index + 1}`}
                className={index === currentImage ? "is-active" : undefined}
                onClick={() => setCurrentImage(index)}
              />
            ))}
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-icon">
                <LibraryBig size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>{value(total)}</strong>
                <span>игр в базе</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Gamepad2 size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>{value(filterData?.genres.length)}</strong>
                <span>жанров</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Monitor size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>{value(filterData?.platforms.length)}</strong>
                <span>платформ</span>
              </div>
            </div>

            <div className="hero-stat">
              <div className="hero-stat-icon">
                <Sparkles size={18} />
              </div>

              <div className="hero-stat-content">
                <strong>{moods.length}</strong>
                <span>настроений</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section reveal">
        <SectionHeading title="Под настроение" text="Выбери, чего хочется, — подборка соберётся за секунду." href="/pick" link="Настроить подбор" />
        <div className="mood-tiles">
          {moods.map(({ id, label, text, icon: Icon, photo }) => {
            const game = moodCovers[id];
            const image = game?.coverUrl ?? photo;
            return (
              <Link key={id} href={`/pick?mood=${id}`} className="mood-tile">
                {image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" loading="lazy" />
                )}
                <span className="mood-tile-shade" />
                <span className="mood-tile-icon"><Icon size={20} /></span>
                <strong>{label}</strong>
                <span className="mood-tile-text">{game ? `Например, ${game.title}` : text}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {topGames && <Featured games={topGames} />}

      {top !== "error" && (
        <section className="page-section reveal">
          <SectionHeading title="Лучшие по оценкам" text="Средняя оценка игроков RAWG." href="/games?sort=rating" />
          {topGames ? (
            <div className="game-grid">
              {topGames.map((game) => <GameCard key={game.id} game={game} />)}
            </div>
          ) : (
            <GridSkeleton count={8} />
          )}
        </section>
      )}

      {sampleGames && filterData && <GenreTiles games={sampleGames} genres={filterData.genres} />}

      {freshGames && freshGames.length > 0 && (
        <section className="page-section reveal">
          <SectionHeading title="Свежие релизы" text="Самые новые игры каталога." href="/games?sort=release-date" />
          <div className="game-grid">
            {freshGames.map((game) => <GameCard key={game.id} game={game} />)}
          </div>
        </section>
      )}

      <section className="page-section reveal">
        <div className="cta-band">
          <div>
            <h2>Не можешь выбрать?</h2>
            <p>Отметь настроение и сколько есть времени — остальное PlayPick сделает сам.</p>
          </div>
          <Link href="/pick" className="primary-button">Подобрать игру <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
