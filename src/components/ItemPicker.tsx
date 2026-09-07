"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TABLE_ITEMS, tableItemSrc, type TableItemId } from "@/lib/table-items";
import type { EmotePickerPlacement } from "@/lib/seat-layout";

export function ItemGlyph({ itemId }: { itemId: TableItemId }) {
  return (
    <img
      className="item-glyph"
      src={tableItemSrc(itemId)}
      alt=""
      draggable={false}
      aria-hidden
    />
  );
}

/** Click an opponent seat to open the item panel. */
export function ItemPicker({
  disabled,
  coolingDown,
  placement = "up",
  onThrow,
  children,
}: {
  disabled?: boolean;
  coolingDown?: boolean;
  placement?: EmotePickerPlacement;
  onThrow: (itemId: TableItemId) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="emote-picker" ref={rootRef}>
      {open ? (
        <div
          id={panelId}
          className={`emote-picker-panel is-items is-${placement}`}
          role="listbox"
          aria-label="选择道具"
        >
          {TABLE_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              className="emote-picker-item"
              disabled={disabled || coolingDown}
              title={item.label}
              aria-label={item.label}
              onClick={() => {
                onThrow(item.id);
                setOpen(false);
              }}
            >
              <ItemGlyph itemId={item.id} />
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="emote-picker-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={coolingDown ? "道具冷却中" : "扔道具"}
        title={coolingDown ? "冷却中" : "点头像扔道具"}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
    </div>
  );
}
