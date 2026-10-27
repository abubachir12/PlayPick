import type { Metadata } from "next";
import PageBanner from "../components/PageBanner";
import FavoritesView from "./FavoritesView";

export const metadata: Metadata = {
  title: "Избранное",
};

export default function FavoritesPage() {
  return (
    <main className="page">
      <PageBanner
        title="Библиотека"
        text="Избранное и пройденное хранятся в этом браузере — вход не нужен."
        image="/hero/rust.jpg"
      />
      <FavoritesView />
    </main>
  );
}
