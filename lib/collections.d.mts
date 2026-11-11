import type { CatalogSort } from "./catalog-query.mjs";

export type CollectionRule = {
  tagsAny?: string[];
  tagsNone?: string[];
  free?: boolean;
  deal?: boolean;
  playing?: boolean;
  maxPrice?: number;
  playtime?: [number, number];
  releasedBefore?: string;
  minRating?: number;
};
export type Collection = { id: string; title: string; text: string; rule: CollectionRule; sort: CatalogSort };
export const COLLECTIONS: Collection[];
export const COLLECTION_IDS: string[];
export function findCollection(id: string): Collection | null;
export function matchesCollection(game: Record<string, unknown>, collection: Collection): boolean;
