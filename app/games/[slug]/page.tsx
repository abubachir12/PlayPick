import { Suspense } from "react";
import GameDetails, { GameDetailsSkeleton } from "./GameDetails";

export default function GamePage({ params }: PageProps<"/games/[slug]">) {
  return (
    <main className="page">
      <Suspense fallback={<GameDetailsSkeleton />}>
        <GameDetails params={params} />
      </Suspense>
    </main>
  );
}
