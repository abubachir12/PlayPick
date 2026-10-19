export class CatalogQueryError extends Error {}
export function parseCatalogQuery(params: URLSearchParams): {
  page: number;
  limit: number;
  search: string;
  offset: number;
};
export function escapeLike(value: string): string;
export function parseCatalogFilters(params: URLSearchParams): {
  genre: string;
  platform: string;
  sort: "title" | "rating" | "release-date";
};
