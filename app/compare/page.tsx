import type { Metadata } from "next";
import { Suspense } from "react";
import PageBanner from "../components/PageBanner";
import CompareView from "./CompareView";

export const metadata: Metadata = {
  title: "Сравнение игр",
};

export default function ComparePage() {
  return (
    <main className="page">
      <PageBanner
        title="Сравнить две игры"
        text="Цена в твоём регионе, оценки, онлайн, длительность и русский язык — рядом, с подсветкой победителя по каждому пункту."
        image="/hero/battlefield.jpg"
      />
      <Suspense fallback={<div className="compare-slots"><div className="compare-slot skeleton" /><div className="compare-slot skeleton" /></div>}>
        <CompareView />
      </Suspense>
    </main>
  );
}
