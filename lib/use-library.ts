"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  clearList,
  emptyLibrary,
  hasGame,
  LIBRARY_KEY,
  parseLibrary,
  toggleGame,
  type Library,
  type LibraryGameInput,
  type LibraryList,
} from "@/lib/library-store.mjs";
import { requestJson } from "@/lib/api-client";
import { toast } from "@/lib/toast";

const CHANGE_EVENT = "playpick-library-change";
const SERVER_SNAPSHOT: Library = emptyLibrary();
let cached: { raw: string | null; value: Library } = { raw: null, value: SERVER_SNAPSHOT };
// Set by the session store: when signed in, every change is also saved to the account.
let accountSync = false;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(LIBRARY_KEY);
  } catch {
    return null;
  }
}

// useSyncExternalStore needs a stable object while storage is unchanged.
function getSnapshot(): Library {
  const raw = readRaw();
  if (raw !== cached.raw) cached = { raw, value: parseLibrary(raw) };
  return cached.value;
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LIBRARY_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function write(next: Library) {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full storage: keep the change for this page view only.
    cached = { raw: cached.raw, value: next };
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

type LibraryChange =
  | { action: "add" | "remove"; list: LibraryList; gameId: number }
  | { action: "clear"; list: LibraryList }
  | { action: "merge"; favorites: number[]; played: number[] };

async function pushChange(change: LibraryChange, rollback: Library) {
  try {
    const { data } = await requestJson<Library>("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    }, "Не удалось сохранить в аккаунт");
    write(parseLibrary(JSON.stringify(data)));
  } catch (error) {
    write(rollback);
    toast(error instanceof Error ? error.message : "Не удалось сохранить в аккаунт");
  }
}

export function readLibrary(): Library {
  return getSnapshot();
}

// Called on sign-in: games collected as a guest are merged into the account, then the account is the source.
export async function attachLibraryToAccount() {
  accountSync = true;
  const local = getSnapshot();
  await pushChange({
    action: "merge",
    favorites: local.favorites.map((game) => game.id),
    played: local.played.map((game) => game.id),
  }, local);
}

// Called on sign-out: the next person at this computer must not see the previous account's lists.
export function detachLibraryFromAccount() {
  accountSync = false;
  write(emptyLibrary());
}

export function useLibrary() {
  const library = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const toggle = useCallback((list: LibraryList, game: LibraryGameInput) => {
    const before = getSnapshot();
    const removing = hasGame(before, list, game.id);
    write(toggleGame(before, list, game));
    if (accountSync) void pushChange({ action: removing ? "remove" : "add", list, gameId: game.id }, before);
  }, []);

  const clear = useCallback((list: LibraryList) => {
    const before = getSnapshot();
    write(clearList(before, list));
    if (accountSync) void pushChange({ action: "clear", list }, before);
  }, []);

  const has = useCallback((list: LibraryList, id: number) => hasGame(library, list, id), [library]);

  return { library, toggle, clear, has };
}
