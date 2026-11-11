"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

// Uses the system share sheet on phones and falls back to copying the link on desktops.
export default function ShareButton({ title, url, label = "Поделиться", className = "library-button with-label" }: {
  title: string;
  url?: string;
  label?: string;
  className?: string;
}) {
  async function share() {
    const link = url ? new URL(url, window.location.origin).href : window.location.href;
    if (navigator.share && window.matchMedia("(hover: none)").matches) {
      try {
        await navigator.share({ title, url: link });
        return;
      } catch {
        // Closing the share sheet is not an error worth reporting.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast("Ссылка скопирована");
    } catch {
      window.prompt("Скопируйте ссылку", link);
    }
  }

  return (
    <button type="button" className={className} onClick={() => void share()}>
      <Share2 size={16} />
      <span>{label}</span>
    </button>
  );
}
