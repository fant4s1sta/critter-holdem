"use client";

import { useEffect, useMemo, useState } from "react";
import type { Card } from "@/lib/types";
import { AI_ASSISTANT_SRC, isImagePreloaded, preloadImage } from "@/lib/animal-display";
import { estimateWinRate } from "@/lib/equity";

export function WinRateHint({
  holeCards,
  communityCards,
  opponentCount,
  handKey,
}: {
  holeCards: Card[];
  communityCards: Card[];
  opponentCount: number;
  /** Changes when a new hand / street / fold set should invalidate the bubble. */
  handKey: string;
}) {
  const [open, setOpen] = useState(false);
  const [iconReady, setIconReady] = useState(() => isImagePreloaded(AI_ASSISTANT_SRC));

  useEffect(() => {
    setOpen(false);
  }, [handKey]);

  useEffect(() => {
    if (isImagePreloaded(AI_ASSISTANT_SRC)) {
      setIconReady(true);
      return;
    }
    void preloadImage(AI_ASSISTANT_SRC).then(() => setIconReady(true));
  }, []);

  const rate = useMemo(() => {
    if (!open || holeCards.length !== 2) return null;
    return estimateWinRate({
      holeCards,
      communityCards,
      opponentCount,
    });
  }, [open, holeCards, communityCards, opponentCount]);

  if (holeCards.length !== 2) return null;

  return (
    <div className="win-rate-hint">
      {open && rate != null ? (
        <div className="win-rate-bubble" role="status">
          当前胜率约 {rate}%
        </div>
      ) : null}
      <button
        type="button"
        className="win-rate-bot"
        aria-label="问机器人胜率分析"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <img
          src={AI_ASSISTANT_SRC}
          alt=""
          className={`win-rate-bot-img ${iconReady ? "is-ready" : ""}`}
          draggable={false}
          decoding="async"
        />
      </button>
    </div>
  );
}
