"use client";

import type { ReactNode } from "react";
import { TABLE_ITEMS, tableItemSrc, type TableItemId } from "@/lib/table-items";
import type { EmotePickerPlacement } from "@/lib/seat-layout";
import { AnchoredMenuPortal, usePickerMenu } from "./AnchoredMenuPortal";

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
  const menuLocked = Boolean(disabled || coolingDown);
  const { open, setOpen, rootRef, triggerRef, panelRef, panelId } =
    usePickerMenu(menuLocked);

  return (
    <div className="emote-picker" ref={rootRef}>
      <AnchoredMenuPortal
        open={open}
        placement={placement}
        triggerRef={triggerRef}
        panelRef={panelRef}
        panelId={panelId}
        className={`emote-picker-panel is-items is-${placement}`}
        label="选择道具"
      >
        {TABLE_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            className="emote-picker-item"
            disabled={menuLocked}
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
      </AnchoredMenuPortal>
      <button
        ref={triggerRef}
        type="button"
        className="emote-picker-trigger"
        disabled={menuLocked}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={coolingDown ? "道具冷却中" : "扔道具"}
        title={coolingDown ? "冷却中" : "点头像扔道具"}
        onClick={() => {
          if (menuLocked) return;
          setOpen((value) => !value);
        }}
      >
        {children}
      </button>
    </div>
  );
}
