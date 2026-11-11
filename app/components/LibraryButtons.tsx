"use client";

import { Check, Heart } from "lucide-react";
import type { LibraryGameInput } from "@/lib/library-store.mjs";
import { toast } from "@/lib/toast";
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
      onClick={(event) => {
        // Cards wrap the button in a link area: keep the click from opening the game.
        event.preventDefault();
        event.stopPropagation();
        toggle("favorites", game);
        toast(active ? `Убрано из избранного: ${game.title}` : `Добавлено в избранное: ${game.title}`);
      }}
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
      onClick={() => {
        toggle("played", game);
        toast(active ? `Снова в подборе: ${game.title}` : `Не будет в подборе: ${game.title}`);
      }}
    >
      <Check size={16} />
      <span>{active ? "Пройдено" : "Уже играл"}</span>
    </button>
  );
}
