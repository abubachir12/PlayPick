"use client";

import { useSyncExternalStore } from "react";
import { MAIN_REGION, REGION_IDS, type RegionId } from "@/lib/regions.mjs";

// The visitor's price region: a per-browser preference, so it lives in localStorage, not in the account.
const KEY = "playpick:region";
const EVENT = "playpick:region";

function read(): RegionId {
  try {
    const value = window.localStorage.getItem(KEY) as RegionId | null;
    return value && REGION_IDS.includes(value) ? value : MAIN_REGION;
  } catch {
    return MAIN_REGION;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setRegion(region: RegionId) {
  try { window.localStorage.setItem(KEY, region); } catch { /* private mode: the choice lasts for this page only */ }
  window.dispatchEvent(new Event(EVENT));
}

// Server render and the first client render use the main region, then the stored choice takes over.
export function useRegion(): RegionId {
  return useSyncExternalStore(subscribe, read, () => MAIN_REGION);
}
