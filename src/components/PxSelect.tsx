"use client";

import { useEffect, useId, useRef, useState } from "react";

export function PxSelect<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`px-select ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="px-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ""}</span>
        <span className="px-select-caret" aria-hidden />
      </button>
      {open ? (
        <ul id={listId} className="px-select-menu" role="listbox">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={String(option.value)} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`px-select-option ${isSelected ? "is-selected" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}