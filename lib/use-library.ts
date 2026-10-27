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

const CHANGE_EVENT = "playpick-library-change";
const SERVER_SNAPSHOT: Library = emptyLibrary();
let cached: { raw: string | null; value: Library } = { raw: null, value: SERVER_SNAPSHOT };

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

export function readLibrary(): Library {
  return getSnapshot();
}

export function useLibrary() {
  const library = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const toggle = useCallback((list: LibraryList, game: LibraryGameInput) => {
    write(toggleGame(getSnapshot(), list, game));
  }, []);

  const clear = useCallback((list: LibraryList) => {
    write(clearList(getSnapshot(), list));
  }, []);

  const has = useCallback((list: LibraryList, id: number) => hasGame(library, list, id), [library]);

  return { library, toggle, clear, has };
}
