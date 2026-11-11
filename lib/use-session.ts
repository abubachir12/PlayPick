"use client";

import { useSyncExternalStore } from "react";
import { requestJson } from "@/lib/api-client";
import { attachLibraryToAccount, detachLibraryFromAccount } from "@/lib/use-library";

export type AccountUser = { id: number; email: string; name: string; createdAt: string };
export type SessionState = { status: "loading" | "guest" | "user"; user: AccountUser | null };

const LOADING: SessionState = { status: "loading", user: null };
let state: SessionState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

async function signedIn(user: AccountUser) {
  set({ status: "user", user });
  await attachLibraryToAccount();
}

async function load() {
  try {
    const { data } = await requestJson<{ user: AccountUser | null }>("/api/auth/me");
    if (data.user) await signedIn(data.user);
    else set({ status: "guest", user: null });
  } catch {
    // Offline or API down: the site keeps working as a guest.
    set({ status: "guest", user: null });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void load();
  }
  return () => listeners.delete(listener);
}

const post = (url: string, body?: unknown) => requestJson<{ user?: AccountUser }>(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body ?? {}),
});

export async function register(input: { email: string; password: string; name: string }) {
  const { data } = await post("/api/auth/register", input);
  if (data.user) await signedIn(data.user);
}

export async function login(input: { email: string; password: string }) {
  const { data } = await post("/api/auth/login", input);
  if (data.user) await signedIn(data.user);
}

export async function logout() {
  await post("/api/auth/logout");
  detachLibraryFromAccount();
  set({ status: "guest", user: null });
}

export async function renameAccount(name: string) {
  const { data } = await requestJson<{ user: AccountUser }>("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }, "Не удалось сохранить имя");
  set({ status: "user", user: data.user });
}

export async function deleteAccount() {
  await requestJson("/api/auth/me", { method: "DELETE" }, "Не удалось удалить аккаунт");
  detachLibraryFromAccount();
  set({ status: "guest", user: null });
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}
