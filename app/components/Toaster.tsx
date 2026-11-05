"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { onToast, type ToastDetail } from "@/lib/toast";

const VISIBLE_MS = 2600;

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastDetail[]>([]);

  useEffect(() => onToast((detail) => {
    setToasts((current) => [...current.slice(-2), detail]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== detail.id)), VISIBLE_MS);
  }), []);

  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className="toast">
          <CheckCircle2 size={18} />
          {item.message}
        </div>
      ))}
    </div>
  );
}
