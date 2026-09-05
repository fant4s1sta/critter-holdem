"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/types";
import { CardBack } from "./CardBack";
import { CardFaceSvg } from "./CardFaceSvg";

export type CommunitySlotMode = "empty" | "back" | "face";

export function CommunityCardSlot({
  mode,
  card,
  slotIndex,
}: {
  mode: CommunitySlotMode;
  card?: Card;
  slotIndex: number;
}) {
  const [flipReady, setFlipReady] = useState(false);

  useEffect(() => {
    if (mode !== "face" || !card) {
      setFlipReady(false);
      return;
    }

    let cancelled = false;
    // Double rAF so the back face paints before the flip transition starts.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setFlipReady(true);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mode, card]);

  if (mode === "empty") {
    return <div className="playing-card community-card-empty" aria-hidden />;
  }

  const useFlip = slotIndex < 3 || !!card;
  if (!useFlip) {
    return <CardBack animate={false} />;
  }

  const flipped = mode === "face" && flipReady;

  return (
    <div
      className={`card-flip community-card-flip${flipped ? " is-flipped" : ""}`}
      aria-label={flipped && card ? undefined : "公共牌未翻开"}
    >
      <div className="card-flip-inner">
        <div className="card-flip-face card-flip-back">
          <CardBack sizeClass="playing-card community-card-fill" animate={false} />
        </div>
        <div className="card-flip-face card-flip-front">
          {card ? (
            <CardFaceSvg
              card={card}
              className="playing-card community-card-face-svg"
            />
          ) : (
            <CardBack sizeClass="playing-card community-card-fill" animate={false} />
          )}
        </div>
      </div>
    </div>
  );
}

export function communitySlotMode(
  index: number,
  cards: Card[],
  revealed: number,
): CommunitySlotMode {
  const isFlopSlot = index < 3;
  const hasCard = index < cards.length;

  if (!hasCard) {
    return isFlopSlot ? "back" : "empty";
  }

  return index < revealed ? "face" : "back";
}
