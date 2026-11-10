export class CatalogQueryError extends Error {}
export function parseCatalogQuery(params: URLSearchParams): {
  page: number;
  limit: number;
  search: string;
  offset: number;
};
export function escapeLike(value: string): string;
export type CatalogSort = "title" | "rating" | "release-date" | "popular" | "discount" | "price";
export const SORTS: CatalogSort[];
export function parseCatalogFilters(params: URLSearchParams): {
  genre: string;
  platform: string;
  sort: CatalogSort;
};
export function parseMarketFilters(params: URLSearchParams, collectionIds?: string[]): {
  deal: boolean;
  free: boolean;
  russian: boolean;
  collection: string | null;
};
