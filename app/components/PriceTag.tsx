"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { CURRENCY_SYMBOLS, formatPrice, type Priced } from "@/lib/format";
import { REGIONS } from "@/lib/regions.mjs";
import { setRegion, useRegion } from "@/lib/use-region";

// Discount badge over a card's cover, in the visitor's region.
export function CardDiscount({ game }: { game: Priced }) {
  const price = formatPrice(game, useRegion());
  return price?.discount ? <span className="game-card-discount">−{price.discount}%</span> : null;
}

// Price line under a card's title, in the visitor's region.
export function CardPrice({ game }: { game: Priced }) {
  const price = formatPrice(game, useRegion());
  if (!price) return null;
  return (
    <p className="game-card-price">
      {price.old && <s>{price.old}</s>}
      <span className={game.isFree ? "is-free" : undefined}>{price.label}</span>
    </p>
  );
}

// Region menu in the site's own style (a native list cannot be themed).
// compact: a small pill with the region code, for the header; align: which edge the list hangs from.
export function RegionSelect({ label = "Регион цен", compact = false, align = "right" }: {
  label?: string; compact?: boolean; align?: "left" | "right";
}) {
  const region = useRegion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = REGIONS.find((item) => item.id === region) ?? REGIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys walk the options; the list is short, so no type-ahead is needed.
  function onListKey(event: React.KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div ref={rootRef} className={`region-select ${compact ? "is-compact" : ""} ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="region-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={14} aria-hidden="true" />
        <span>{compact ? region.toUpperCase() : `${current.label} · ${CURRENCY_SYMBOLS[current.currency] ?? current.currency}`}</span>
        <ChevronDown size={14} className="region-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className={`region-menu align-${align}`} role="listbox" aria-label={label} onKeyDown={onListKey}>
          {REGIONS.map((item) => (
            <li key={item.id} role="option" aria-selected={item.id === region}>
              <button
                type="button"
                className={item.id === region ? "is-selected" : undefined}
                autoFocus={item.id === region}
                onClick={() => {
                  setRegion(item.id);
                  setOpen(false);
                }}
              >
                <span className="region-code">{item.id.toUpperCase()}</span>
                <span className="region-name">{item.label}</span>
                <span className="region-currency">{CURRENCY_SYMBOLS[item.currency] ?? item.currency}</span>
                <Check size={14} className="region-check" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
