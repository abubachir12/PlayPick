import type { Metadata } from "next";
import PageBanner from "../components/PageBanner";
import CollectionsView from "./CollectionsView";

export const metadata: Metadata = {
  title: "Подборки игр",
};

export default function CollectionsPage() {
  return (
    <main className="page">
      <PageBanner
        title="Подборки"
        text="Готовые списки на разные случаи: с друзьями, на вечер, со скидкой. Собираются автоматически и всегда актуальны."
        image="/hero/witcher.jpg"
      />
      <CollectionsView />
    </main>
  );
}
