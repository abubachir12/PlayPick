"use client";

// A tiny event-based toast bus: any component can announce a short confirmation.
const TOAST_EVENT = "playpick-toast";

export type ToastDetail = { id: number; message: string };

let nextId = 1;

export function toast(message: string) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { id: nextId++, message } }));
}

export function onToast(listener: (detail: ToastDetail) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<ToastDetail>).detail);
  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
}
