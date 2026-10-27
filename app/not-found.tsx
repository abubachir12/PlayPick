import Link from "next/link";
import PageBanner from "./components/PageBanner";

export default function NotFound() {
  return (
    <main className="page">
      <PageBanner
        title="Страница не найдена"
        text="Возможно, ссылка устарела. Загляни в каталог или подбери игру под настроение."
        image="/hero/battlefield.jpg"
      />
      <div className="center-row">
        <Link href="/games" className="secondary-button">Каталог</Link>
        <Link href="/pick" className="primary-button">Подобрать игру</Link>
      </div>
    </main>
  );
}
