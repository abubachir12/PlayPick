import type { Metadata } from "next";
import { Suspense } from "react";
import PageBanner from "../components/PageBanner";
import { GridSkeleton } from "../components/States";
import CatalogView from "./CatalogView";

export const metadata: Metadata = {
  title: "Каталог игр",
};

export default function GamesPage() {
  return (
    <main className="page">
      <PageBanner
        title="Каталог"
        text="Все игры PlayPick: ищи по названию, фильтруй по жанру и платформе."
        image="/hero/ark.jpg"
      />
      <Suspense fallback={<GridSkeleton />}>
        <CatalogView />
      </Suspense>
    </main>
  );
}
