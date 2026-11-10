import Link from "next/link";
import { Star } from "lucide-react";
import type { LibraryGameInput } from "@/lib/library-store.mjs";
import { formatPrice, formatRating, releaseYear } from "@/lib/format";
import GameCover from "./GameCover";
import { FavoriteButton } from "./LibraryButtons";

// Library entries carry only the basics; catalog rows also bring the Steam price.
type CardGame = LibraryGameInput & {
  isFree?: boolean | null;
  priceFinal?: number | null;
  priceInitial?: number | null;
  discountPercent?: number | null;
  priceCurrency?: string | null;
};

export default function GameCard({ game, children }: { game: CardGame; children?: React.ReactNode }) {
  const year = releaseYear(game.releaseDate);
  const rating = formatRating(game.rating);
  const meta = [year, ...(game.genres ?? []).slice(0, 2)].filter(Boolean).join(" · ");
  const price = formatPrice(game);

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
          {price?.discount && <span className="game-card-discount">−{price.discount}%</span>}
        </div>
        <div className="game-card-body">
          <h3>{game.title}</h3>
          {meta && <p className="game-card-meta">{meta}</p>}
          {price && (
            <p className="game-card-price">
              {price.old && <s>{price.old}</s>}
              <span className={game.isFree ? "is-free" : undefined}>{price.label}</span>
            </p>
          )}
        </div>
      </Link>
      <div className="game-card-favorite">
        <FavoriteButton game={game} />
      </div>
      {children && <div className="game-card-extra">{children}</div>}
    </article>
  );
}
