"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TABLE_EMOTES, type EmoteId } from "@/lib/emotes";

export function EmotePicker({
  disabled,
  coolingDown,
  onSend,
}: {
  disabled?: boolean;
  coolingDown?: boolean;
  onSend: (emoteId: EmoteId) => void;
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
          className="emote-picker-panel"
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
              <span aria-hidden="true">{item.emoji}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="emote-picker-toggle"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="发送表情"
        title={coolingDown ? "冷却中" : "表情"}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">😀</span>
      </button>
    </div>
  );
}

export function SeatEmoteBubble({
  emoji,
  at,
}: {
  emoji: string;
  at: number;
}) {
  return (
    <div className="seat-emote-bubble" key={at} aria-hidden="true">
      <span className="seat-emote-bubble-emoji">{emoji}</span>
    </div>
  );
}
