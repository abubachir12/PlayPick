export type LibraryList = "favorites" | "played";
export interface LibraryGame {
  id: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  genres: string[];
  rating: number | null;
}
export interface Library {
  favorites: LibraryGame[];
  played: LibraryGame[];
}
export interface LibraryGameInput {
  id: number;
  slug: string;
  title: string;
  coverUrl?: string | null;
  releaseDate?: string | null;
  genres?: string[] | null;
  rating?: number | null;
}
export const LIBRARY_KEY: string;
export const LIBRARY_LISTS: LibraryList[];
export const LIST_LIMIT: number;
export function emptyLibrary(): Library;
export function toLibraryGame(game: unknown): LibraryGame | null;
export function parseLibrary(raw: string | null | undefined): Library;
export function hasGame(library: Library, list: LibraryList, id: number): boolean;
export function toggleGame(library: Library, list: LibraryList, game: LibraryGameInput): Library;
export function clearList(library: Library, list: LibraryList): Library;
