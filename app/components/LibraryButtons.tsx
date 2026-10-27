"use client";

import { Check, Heart } from "lucide-react";
import type { LibraryGameInput } from "@/lib/library-store.mjs";
import { useLibrary } from "@/lib/use-library";

export function FavoriteButton({ game, withLabel = false }: { game: LibraryGameInput; withLabel?: boolean }) {
  const { has, toggle } = useLibrary();
  const active = has("favorites", game.id);
  const label = active ? "Убрать из избранного" : "В избранное";

  return (
    <button
      type="button"
      className={`library-button ${active ? "is-active" : ""} ${withLabel ? "with-label" : "icon-only"}`}
      aria-pressed={active}
      aria-label={withLabel ? undefined : `${label}: ${game.title}`}
      title={label}
      onClick={() => toggle("favorites", game)}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} />
      {withLabel && <span>{active ? "В избранном" : "В избранное"}</span>}
    </button>
  );
}

export function PlayedButton({ game }: { game: LibraryGameInput }) {
  const { has, toggle } = useLibrary();
  const active = has("played", game.id);

  return (
    <button
      type="button"
      className={`library-button with-label ${active ? "is-active" : ""}`}
      aria-pressed={active}
      title={active ? "Снова показывать в подборе" : "Не показывать в подборе"}
      onClick={() => toggle("played", game)}
    >
      <Check size={16} />
      <span>{active ? "Пройдено" : "Уже играл"}</span>
    </button>
  );
}
