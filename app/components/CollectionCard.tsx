import Link from "next/link";
import { pluralize } from "@/lib/format";

export type CollectionTile = { id: string; title: string; text: string; total: number; covers: string[]; example: string | null };

export default function CollectionCard({ tile, large = false }: { tile: CollectionTile; large?: boolean }) {
  return (
    <Link href={`/collections/${tile.id}`} className={`genre-tile collection-tile ${large ? "is-large" : ""}`}>
      {tile.covers[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.covers[0]} alt="" loading="lazy" />
      )}
      <span className="genre-tile-shade" />
      <span className="collection-count">{tile.total} {pluralize(tile.total, "игра", "игры", "игр")}</span>
      <strong>{tile.title}</strong>
      <span>{large ? tile.text : tile.example ? `например, ${tile.example}` : tile.text}</span>
    </Link>
  );
}
