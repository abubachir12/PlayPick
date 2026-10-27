"use client";

import { useState } from "react";
import Link from "next/link";
import type { LibraryList } from "@/lib/library-store.mjs";
import { useLibrary } from "@/lib/use-library";
import GameCard from "../components/GameCard";
import { PlayedButton } from "../components/LibraryButtons";
import { EmptyState } from "../components/States";

const tabs: { id: LibraryList; label: string; empty: string }[] = [
  { id: "favorites", label: "Избранное", empty: "Сохраняй игры сердечком на карточке. Список хранится в этом браузере." },
  { id: "played", label: "Пройдено", empty: "Игры, отмеченные «Уже играл», не попадают в подбор." },
];

export default function FavoritesView() {
  const { library, clear } = useLibrary();
  const [active, setActive] = useState<LibraryList>("favorites");
  const tab = tabs.find((item) => item.id === active) ?? tabs[0];
  const games = library[active];

  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            className={`tab ${item.id === active ? "is-active" : ""}`}
            onClick={() => setActive(item.id)}
          >
            {item.label} <span className="tab-count">{library[item.id].length}</span>
          </button>
        ))}

        {games.length > 0 && (
          <button
            type="button"
            className="text-link tabs-clear"
            onClick={() => {
              if (window.confirm(`Очистить список «${tab.label}»?`)) clear(active);
            }}
          >
            Очистить список
          </button>
        )}
      </div>

      {games.length === 0 ? (
        <EmptyState title="Пока пусто">
          <p>{tab.empty}</p>
          <div className="center-row">
            <Link href="/games" className="secondary-button small">Каталог</Link>
            <Link href="/pick" className="primary-button small">Подобрать игру</Link>
          </div>
        </EmptyState>
      ) : (
        <div className="game-grid" role="tabpanel">
          {games.map((game) => (
            <GameCard key={game.id} game={game}>
              <PlayedButton game={game} />
            </GameCard>
          ))}
        </div>
      )}
    </>
  );
}
