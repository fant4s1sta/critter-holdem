"use client";

import type { ReactNode } from "react";
import {
  EMOTE_STICKER_SRC,
  TABLE_EMOTES,
  emoteSpritePosition,
  type EmoteId,
} from "@/lib/emotes";
import type { EmotePickerPlacement } from "@/lib/seat-layout";
import { AnchoredMenuPortal, usePickerMenu } from "./AnchoredMenuPortal";

export function EmoteSticker({
  emoteId,
  className,
}: {
  emoteId: EmoteId;
  className?: string;
}) {
  const emote = TABLE_EMOTES.find((item) => item.id === emoteId);
  if (!emote) return null;
  return (
    <span
      className={className ? `emote-sticker ${className}` : "emote-sticker"}
      style={{
        backgroundImage: `url(${EMOTE_STICKER_SRC})`,
        backgroundPosition: emoteSpritePosition(emote.col, emote.row),
      }}
      aria-hidden
    />
  );
}

/** Click own seat avatar to open the sticker panel. */
export function EmotePicker({
  disabled,
  coolingDown,
  placement = "up",
  onSend,
  children,
}: {
  disabled?: boolean;
  coolingDown?: boolean;
  placement?: EmotePickerPlacement;
  onSend: (emoteId: EmoteId) => void;
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
        className={`emote-picker-panel is-${placement}`}
        label="选择表情"
      >
        {TABLE_EMOTES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            className="emote-picker-item"
            disabled={menuLocked}
            title={item.label}
            aria-label={item.label}
            onClick={() => {
              onSend(item.id);
              setOpen(false);
            }}
          >
            <EmoteSticker emoteId={item.id} />
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
        aria-label={coolingDown ? "表情冷却中" : "发送表情"}
        title={coolingDown ? "冷却中" : "点头像发表情"}
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

export function SeatEmoteBubble({
  emoteId,
}: {
  emoteId: EmoteId;
  /** Stable remount token — applied by parent via React `key`. */
  at?: number;
}) {
  return (
    <div className="seat-emote-bubble" aria-hidden="true">
      <EmoteSticker emoteId={emoteId} />
    </div>
  );
}
