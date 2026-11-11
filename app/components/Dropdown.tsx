"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption = { value: string; label: string };

// A select in the site's own style: the browser's native list cannot be themed and looks foreign on a dark page.
// Keyboard: Enter/Space/ArrowDown open, arrows/Home/End move, Enter picks, Escape closes; typing a letter jumps to it.
export default function Dropdown({ value, options, onChange, label, className = "" }: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Accessible name; shown nowhere, the visible caption is the caller's. */
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    // The picked option is brought into view in long lists (genres, platforms).
    rootRef.current?.querySelector<HTMLElement>(".is-selected")?.focus();
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  function close(focusButton = true) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function onListKey(event: React.KeyboardEvent<HTMLUListElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      return close();
    }
    if (event.key === "Tab") return setOpen(false);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      next = options.findIndex((option, at) => at > index && option.label.toLowerCase().startsWith(letter));
      if (next < 0) next = options.findIndex((option) => option.label.toLowerCase().startsWith(letter));
    }
    if (next >= 0) {
      event.preventDefault();
      items[next]?.focus();
    }
  }

  return (
    <div ref={rootRef} className={`dropdown ${open ? "is-open" : ""} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current?.label ?? ""}`}
        onClick={() => setOpen((state) => !state)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{current?.label}</span>
        <ChevronDown size={16} className="dropdown-chevron" aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="dropdown-menu" role="listbox" aria-label={label} onKeyDown={onListKey}>
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                className={option.value === value ? "is-selected" : undefined}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                <span>{option.label}</span>
                <Check size={14} className="dropdown-check" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
