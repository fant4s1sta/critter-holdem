"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/types";
import { getCardAssetPath, preloadCardImage, SUIT_LABELS } from "@/lib/card-visuals";
import { CardBack } from "./CardBack";

export type CommunitySlotMode = "empty" | "back" | "face";

function CommunityCardFace({ card }: { card: Card }) {
  const assetRank = card.rank === "T" ? "10" : card.rank;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getCardAssetPath(card)}
      alt={`${assetRank} ${SUIT_LABELS[card.suit]}`}
      className="community-card-face-img"
      width={242}
      height={340}
      loading="eager"
      decoding="sync"
      draggable={false}
      aria-hidden
    />
  );
}

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
    void preloadCardImage(card).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setFlipReady(true);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mode, card]);

  if (mode === "empty") {
    return (
      <div
        className="playing-card community-card-empty"
        aria-hidden
      />
    );
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
            <CommunityCardFace card={card} />
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
