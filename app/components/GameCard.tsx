import Link from "next/link";
import { Star } from "lucide-react";
import type { LibraryGameInput } from "@/lib/library-store.mjs";
import { formatRating, releaseYear } from "@/lib/format";
import GameCover from "./GameCover";
import { FavoriteButton } from "./LibraryButtons";

export default function GameCard({ game, children }: { game: LibraryGameInput; children?: React.ReactNode }) {
  const year = releaseYear(game.releaseDate);
  const rating = formatRating(game.rating);
  const meta = [year, ...(game.genres ?? []).slice(0, 2)].filter(Boolean).join(" · ");

  return (
    <article className="game-card">
      <Link href={`/games/${encodeURIComponent(game.slug)}`} className="game-card-link">
        <div className="game-card-media">
          <GameCover src={game.coverUrl} title={game.title} />
          {rating && (
            <span className="game-card-rating">
              <Star size={12} fill="currentColor" /> {rating}
            </span>
          )}
        </div>
        <div className="game-card-body">
          <h3>{game.title}</h3>
          {meta && <p className="game-card-meta">{meta}</p>}
        </div>
      </Link>
      <div className="game-card-favorite">
        <FavoriteButton game={game} />
      </div>
      {children && <div className="game-card-extra">{children}</div>}
    </article>
  );
}
