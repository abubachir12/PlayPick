"use client";

import { useEffect, useState } from "react";
import { errorMessage, requestJson } from "@/lib/api-client";
import CollectionCard, { type CollectionTile } from "../components/CollectionCard";
import { ErrorState, GridSkeleton } from "../components/States";

export default function CollectionsView() {
  const [state, setState] = useState<{ tiles?: CollectionTile[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    requestJson<CollectionTile[]>("/api/collections", undefined, "Не удалось загрузить подборки")
      .then(({ data }) => !cancelled && setState({ tiles: data }))
      .catch((error) => !cancelled && setState({ error: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!state) return <GridSkeleton count={8} />;
  if (!state.tiles) {
    return <ErrorState message={state.error ?? "Не удалось загрузить подборки"} onRetry={() => { setState(null); setAttempt((value) => value + 1); }} />;
  }

  return (
    <div className="collection-grid">
      {state.tiles.map((tile) => <CollectionCard key={tile.id} tile={tile} large />)}
    </div>
  );
}
