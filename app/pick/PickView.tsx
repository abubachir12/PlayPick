"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Coffee, Compass, Dices, Heart, Sparkles, Sword, Users } from "lucide-react";
import type { GameLength, Mood } from "@/lib/recommendations.mjs";
import type { RecommendationRequest, RecommendationResponse } from "@/types/recommendation";
import { errorMessage, requestJson } from "@/lib/api-client";
import { readLibrary, useLibrary } from "@/lib/use-library";
import { formatCount, pluralize } from "@/lib/format";
import Dropdown from "../components/Dropdown";
import GameCard from "../components/GameCard";
import { PlayedButton } from "../components/LibraryButtons";
import ShareButton from "../components/ShareButton";
import { EmptyState, ErrorState, GridSkeleton } from "../components/States";

const moodIcons: Record<Mood, typeof Coffee> = {
  relax: Coffee,
  challenge: Sword,
  story: BookOpen,
  explore: Compass,
  social: Users,
};

// Used until /api/recommendations/options answers; the API remains the source of truth.
const fallbackMoods: { id: Mood; label: string }[] = [
  { id: "relax", label: "Расслабиться" },
  { id: "challenge", label: "Испытать себя" },
  { id: "story", label: "Погрузиться в сюжет" },
  { id: "explore", label: "Исследовать мир" },
  { id: "social", label: "Поиграть вместе" },
];

const sessionChoices = [15, 30, 60, 120];
const MAX_GENRES = 5;
const MAX_EXCLUDED = 100;
const RESULT_LIMIT = 8;

type Filters = { genres: string[]; platforms: string[] };
type Item = RecommendationResponse["items"][number];

function isMood(value: string | null, moods: { id: Mood }[]): value is Mood {
  return moods.some((mood) => mood.id === value);
}

// RAWG average playtime of the whole game; the same bounds as LENGTHS in lib/recommendations.mjs.
const lengthChoices: { id: GameLength; label: string }[] = [
  { id: "short", label: "Короткие — до 8 ч" },
  { id: "medium", label: "Средние — 8–25 ч" },
  { id: "long", label: "Длинные — от 25 ч" },
];

function minutesLabel(minutes: number) {
  return minutes < 60 ? `${minutes} мин` : `${minutes / 60} ${pluralize(minutes / 60, "час", "часа", "часов")}`;
}

// The API explains every point of the score; the card shows only what matched.
function MatchSummary({ item }: { item: Item }) {
  const matched = item.reasons.filter((reason) => reason.code.startsWith("mood-")).map((reason) => reason.value);
  const favorite = item.reasons.filter((reason) => reason.code === "preferred-genre").map((reason) => reason.value);
  const taste = item.reasons.find((reason) => reason.code === "taste");
  const critics = item.reasons.find((reason) => reason.code === "critics");
  const length = item.reasons.find((reason) => reason.code === "length");
  const { sessionFit } = item;

  return (
    <div className="match">
      {taste && <p className="match-taste"><Heart size={12} fill="currentColor" /> Похоже на «{taste.value}»</p>}
      {matched.length > 0 && <p><span>Совпало</span> {matched.join(", ")}</p>}
      {favorite.length > 0 && <p><span>Любимый жанр</span> {favorite.join(", ")}</p>}
      {critics && <p><span>Критики</span> Metacritic {critics.value}</p>}
      {length && <p><span>Длина</span> ≈ {length.value} ч</p>}
      {sessionFit.status === "estimated-fit" && sessionFit.minimumMinutes && (
        <p title={sessionFit.note ?? undefined}><span>Сессия</span> от {sessionFit.minimumMinutes} мин, оценка PlayPick</p>
      )}
    </div>
  );
}

export default function PickView() {
  const params = useSearchParams();
  const router = useRouter();
  const { library } = useLibrary();
  const [moods, setMoods] = useState(fallbackMoods);
  const [filters, setFilters] = useState<Filters>({ genres: [], platforms: [] });

  // A shared link restores the whole form: /pick?mood=story&platform=PC&genres=RPG,Indie&time=30
  const initialMood = params.get("mood");
  const initialTime = Number(params.get("time"));
  const [mood, setMood] = useState<Mood | null>(isMood(initialMood, fallbackMoods) ? initialMood : null);
  const [platform, setPlatform] = useState(() => params.get("platform")?.slice(0, 200) ?? "");
  const [genres, setGenres] = useState<string[]>(() => (params.get("genres") ?? "")
    .split(",").map((name) => name.trim()).filter((name) => name && name.length <= 200).slice(0, MAX_GENRES));
  const [sessionMinutes, setSessionMinutes] = useState<number | null>(
    sessionChoices.includes(initialTime) ? initialTime : null,
  );
  const [includeUnknownSession, setIncludeUnknownSession] = useState(true);
  const [skipPlayed, setSkipPlayed] = useState(true);
  const [useTaste, setUseTaste] = useState(true);
  const [freeOnly, setFreeOnly] = useState(() => params.get("free") === "1");
  const [length, setLength] = useState<GameLength | "">(() => {
    const value = params.get("length");
    return value === "short" || value === "medium" || value === "long" ? value : "";
  });

  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [shownIds, setShownIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    requestJson<{ moods: { id: Mood; label: string }[] }>("/api/recommendations/options")
      .then(({ data }) => data.moods.length && setMoods(data.moods))
      .catch(() => {});
    requestJson<Filters>("/api/catalog/filters").then(({ data }) => setFilters(data)).catch(() => {});
  }, []);

  async function run(options: { more?: boolean } = {}) {
    if (!mood) return;
    // Read storage directly: the auto-start runs before the hydrated library reaches this closure.
    const stored = readLibrary();
    const playedIds = skipPlayed ? stored.played.map((game) => game.id) : [];
    const likedIds = useTaste ? stored.favorites.map((game) => game.id).slice(0, MAX_EXCLUDED) : [];
    const previous = options.more ? shownIds : [];
    const excludeIds = [...new Set([...playedIds, ...previous])].slice(0, MAX_EXCLUDED);
    const body: RecommendationRequest = { mood, limit: RESULT_LIMIT };
    if (platform) body.platform = platform;
    if (genres.length) body.preferredGenres = genres;
    if (excludeIds.length) body.excludeIds = excludeIds;
    if (likedIds.length) body.likedIds = likedIds;
    if (freeOnly) body.freeOnly = true;
    if (length) body.length = length;
    if (sessionMinutes) {
      body.sessionMinutes = sessionMinutes;
      body.includeUnknownSession = includeUnknownSession;
    }

    const query = new URLSearchParams({ mood });
    if (platform) query.set("platform", platform);
    if (sessionMinutes) query.set("time", String(sessionMinutes));
    if (length) query.set("length", length);
    if (freeOnly) query.set("free", "1");
    // Commas stay readable in shared links; each genre name is still encoded on its own.
    const genreQuery = genres.length ? `&genres=${genres.map(encodeURIComponent).join(",")}` : "";
    router.replace(`/pick?${query}${genreQuery}`, { scroll: false });

    setLoading(true);
    setError(null);
    try {
      const { data } = await requestJson<RecommendationResponse>("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, "Не удалось подобрать игры");
      setResult(data);
      setShownIds([...previous, ...data.items.map((item) => item.game.id)]);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  // A mood link from the home page starts the pick right away.
  useEffect(() => {
    if (autoStarted.current || !mood || !isMood(initialMood, fallbackMoods)) return;
    autoStarted.current = true;
    void run();
    // run() reads the current form state; this effect must fire only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleGenre(name: string) {
    setGenres((current) => current.includes(name)
      ? current.filter((item) => item !== name)
      : current.length < MAX_GENRES ? [...current, name] : current);
  }

  const canShowMore = result && result.meta.eligibleCount > result.meta.returnedCount && shownIds.length < MAX_EXCLUDED;
  const isMore = result && shownIds.length > result.items.length;

  return (
    <>
      <form
        className="pick-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <fieldset>
          <legend>Настроение</legend>
          <div className="mood-row">
            {moods.map(({ id, label }) => {
              const Icon = moodIcons[id] ?? Sparkles;
              return (
                <label key={id} className={`mood-pill ${mood === id ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="mood"
                    value={id}
                    checked={mood === id}
                    onChange={() => setMood(id)}
                    className="visually-hidden"
                  />
                  <Icon size={18} />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="pick-row">
          <div className="field labeled">
            <span>Платформа</span>
            <Dropdown
              label="Платформа"
              value={platform}
              onChange={setPlatform}
              options={[{ value: "", label: "Любая" }, ...filters.platforms.map((name) => ({ value: name, label: name }))]}
            />
          </div>

          <div className="field labeled">
            <span>Время на сессию</span>
            <Dropdown
              label="Время на сессию"
              value={sessionMinutes ? String(sessionMinutes) : ""}
              onChange={(value) => setSessionMinutes(value ? Number(value) : null)}
              options={[{ value: "", label: "Не важно" },
                ...sessionChoices.map((minutes) => ({ value: String(minutes), label: minutesLabel(minutes) }))]}
            />
          </div>

          <div className="field labeled">
            <span>Длина игры</span>
            <Dropdown
              label="Длина игры"
              value={length}
              onChange={(value) => setLength(value as GameLength | "")}
              options={[{ value: "", label: "Любая" }, ...lengthChoices.map((choice) => ({ value: choice.id, label: choice.label }))]}
            />
          </div>
        </div>

        {filters.genres.length > 0 && (
          <fieldset>
            <legend>Любимые жанры <span className="hint">{genres.length}/{MAX_GENRES}</span></legend>
            <div className="chip-list">
              {filters.genres.map((name) => {
                const selected = genres.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={`chip chip-toggle ${selected ? "is-selected" : ""}`}
                    aria-pressed={selected}
                    disabled={!selected && genres.length >= MAX_GENRES}
                    onClick={() => toggleGenre(name)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="pick-footer">
          <div className="pick-options">
            <label className="checkbox">
              <input type="checkbox" checked={useTaste} onChange={(event) => setUseTaste(event.target.checked)}
                disabled={library.favorites.length === 0} />
              Учитывать мои вкусы по избранному
              <span className="hint">
                {library.favorites.length ? library.favorites.length : "добавь игры в избранное"}
              </span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={freeOnly} onChange={(event) => setFreeOnly(event.target.checked)} />
              Только бесплатные
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={skipPlayed} onChange={(event) => setSkipPlayed(event.target.checked)} />
              Скрыть игры, в которые уже играл
              {library.played.length > 0 && <span className="hint">{library.played.length}</span>}
            </label>
            {sessionMinutes !== null && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!includeUnknownSession}
                  onChange={(event) => setIncludeUnknownSession(!event.target.checked)}
                />
                Только игры с известной длительностью сессии
              </label>
            )}
          </div>

          <button type="submit" className="primary-button" disabled={!mood || loading}>
            {loading ? "Подбираем…" : mood ? "Подобрать" : "Выбери настроение"}
          </button>
        </div>
      </form>

      <div ref={resultsRef} className="pick-results">
        {error && <ErrorState message={error} onRetry={() => void run()} />}

        {loading && !result && <GridSkeleton count={4} />}

        {result && (
          <>
            {result.items.length === 0 ? (
              <EmptyState title="Ничего не подошло">
                <p>Попробуй другое настроение или убери ограничения.</p>
              </EmptyState>
            ) : (
              <>
                <div className="section-heading">
                  <h2>
                    {isMore ? "Ещё варианты" : "Подборка"}
                    <span className="heading-count">
                      {formatCount(result.meta.eligibleCount)} {pluralize(result.meta.eligibleCount, "игра", "игры", "игр")}
                    </span>
                  </h2>
                  <div className="heading-actions">
                    <ShareButton title="Подборка PlayPick" label="Поделиться подборкой" className="secondary-button small" />
                    <button
                      type="button"
                      className="secondary-button small"
                      onClick={() => {
                        const item = result.items[Math.floor(Math.random() * result.items.length)];
                        router.push(`/games/${encodeURIComponent(item.game.slug)}`);
                      }}
                    >
                      <Dices size={16} /> Мне повезёт
                    </button>
                  </div>
                </div>
                {result.meta.session.unknownIncluded > 0 && (
                  <p className="hint result-note">
                    Для части игр длительность сессии неизвестна — проверь сам, хватит ли времени.
                  </p>
                )}
                <div className="game-grid">
                  {result.items.map((item) => (
                    <GameCard key={item.game.id} game={item.game}>
                      <MatchSummary item={item} />
                      <PlayedButton game={item.game} />
                    </GameCard>
                  ))}
                </div>
              </>
            )}

            {canShowMore && (
              <div className="center-row">
                <button type="button" className="secondary-button" disabled={loading} onClick={() => void run({ more: true })}>
                  {loading ? "Подбираем…" : "Показать другие"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
