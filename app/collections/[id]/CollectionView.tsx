"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { findCollection } from "@/lib/collections.mjs";
import CatalogView from "../../games/CatalogView";
import PageBanner from "../../components/PageBanner";
import ShareButton from "../../components/ShareButton";
import { EmptyState } from "../../components/States";

export default function CollectionView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const collection = findCollection(id);

  if (!collection) {
    return (
      <EmptyState title="Такой подборки нет">
        <title>Подборка не найдена — PlayPick</title>
        <p>Возможно, ссылка устарела.</p>
        <Link href="/collections" className="secondary-button small">Все подборки</Link>
      </EmptyState>
    );
  }

  return (
    <>
      <title>{`${collection.title} — PlayPick`}</title>
      <PageBanner title={collection.title} text={collection.text} image="/hero/witcher.jpg" />
      <nav className="breadcrumbs collection-bar" aria-label="Навигация">
        <Link href="/collections" className="back-link"><ArrowLeft size={16} /> Все подборки</Link>
        <ShareButton title={`${collection.title} — PlayPick`} />
      </nav>
      <CatalogView collection={collection.id} defaultSort={collection.sort} />
    </>
  );
}
