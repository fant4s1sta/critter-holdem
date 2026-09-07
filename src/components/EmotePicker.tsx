"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  EMOTE_STICKER_SRC,
  TABLE_EMOTES,
  emoteSpritePosition,
  type EmoteId,
} from "@/lib/emotes";
import type { EmotePickerPlacement } from "@/lib/seat-layout";

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
          className={`emote-picker-panel is-${placement}`}
          role="listbox"
          aria-label="选择表情"
        >
          {TABLE_EMOTES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              className="emote-picker-item"
              disabled={disabled || coolingDown}
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
        </div>
      ) : null}
      <button
        type="button"
        className="emote-picker-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={coolingDown ? "表情冷却中" : "发送表情"}
        title={coolingDown ? "冷却中" : "点头像发表情"}
        onClick={() => setOpen((value) => !value)}
      >
        {children}
      </button>
    </div>
  );
}

export function SeatEmoteBubble({
  emoteId,
  at,
}: {
  emoteId: EmoteId;
  at: number;
}) {
  return (
    <div className="seat-emote-bubble" key={at} aria-hidden="true">
      <EmoteSticker emoteId={emoteId} />
    </div>
  );
}
