import type { Metadata } from "next";
import { Suspense } from "react";
import PageBanner from "../components/PageBanner";
import PickView from "./PickView";

export const metadata: Metadata = {
  title: "Подбор игры",
};

export default function PickPage() {
  return (
    <main className="page">
      <PageBanner
        title="Подбор"
        text="Выбери настроение — платформа, время и жанры по желанию."
        image="/hero/witcher.jpg"
      />
      <Suspense fallback={<div className="pick-form skeleton" style={{ minHeight: 320 }} />}>
        <PickView />
      </Suspense>
    </main>
  );
}
