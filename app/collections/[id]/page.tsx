import { Suspense } from "react";
import { GridSkeleton } from "../../components/States";
import CollectionView from "./CollectionView";

export default function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  return (
    <main className="page">
      <Suspense fallback={<GridSkeleton />}>
        <CollectionView params={params} />
      </Suspense>
    </main>
  );
}
