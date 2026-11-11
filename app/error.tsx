"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import PageBanner from "./components/PageBanner";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page">
      <PageBanner
        title="Что-то пошло не так"
        text="Страница не загрузилась. Попробуй ещё раз — обычно это помогает."
        image="/hero/battlefield.jpg"
      />
      <div className="center-row">
        <button type="button" className="primary-button" onClick={() => retry()}>Попробовать снова</button>
        <Link href="/" className="secondary-button">На главную</Link>
      </div>
    </main>
  );
}
