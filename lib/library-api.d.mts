import type { LibraryList } from "./library-store.mjs";

export class LibraryRequestError extends Error {
  constructor(message: string, status?: number);
  status: number;
}
export type LibraryChange =
  | { action: "merge"; favorites: number[]; played: number[] }
  | { action: "add" | "remove"; list: LibraryList; gameId: number }
  | { action: "clear"; list: LibraryList };
export function parseLibraryChange(input: unknown): LibraryChange;
