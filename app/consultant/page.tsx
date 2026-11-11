import type { Metadata } from "next";
import PageBanner from "../components/PageBanner";
import ConsultantChat from "./ConsultantChat";

export const metadata: Metadata = {
  title: "ИИ-консультант",
};

export default function ConsultantPage() {
  return (
    <main className="page">
      <PageBanner
        title="ИИ-консультант"
        text="Расскажи своими словами, во что хочется поиграть, — консультант подберёт игры из каталога PlayPick."
        image="/hero/battlefield.jpg"
      />
      <ConsultantChat />
    </main>
  );
}
