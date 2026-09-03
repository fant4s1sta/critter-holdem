"use client";

import type { Card } from "@/lib/types";
import { CardBack } from "@/components/CardBack";
import { getCardAssetPath, SUIT_LABELS } from "@/lib/card-visuals";

export function PlayingCard({
  card,
  faceDown = false,
  small = false,
  size,
  dealDelay = 0,
  animate = true,
}: {
  card?: Card | null;
  faceDown?: boolean;
  small?: boolean;
  size?: "lg" | "md" | "sm" | "xs";
  dealDelay?: number;
  animate?: boolean;
}) {
  const resolved = size ?? (small ? "sm" : "md");
  const sizeClass =
    resolved === "xs"
      ? "playing-card playing-card-xs"
      : resolved === "sm"
        ? "playing-card playing-card-sm"
        : resolved === "lg"
          ? "playing-card playing-card-lg"
          : "playing-card";
  const motionClass = animate ? "card-deal " : "";
  if (faceDown || !card) {
    return (
      <CardBack
        sizeClass={`${motionClass}${sizeClass}`.trim()}
        dealDelay={dealDelay}
      />
    );
  }

  const assetRank = card.rank === "T" ? "10" : card.rank;
  const cardAssetUrl = getCardAssetPath(card);

  return (
    <img
      src={cardAssetUrl}
      alt={`${assetRank} ${SUIT_LABELS[card.suit]}`}
      className={`${motionClass}${sizeClass} block object-contain`.trim()}
      width={242}
      height={340}
      loading="eager"
      decoding="sync"
      style={{
        animationDelay: `${dealDelay}ms`,
      }}
      aria-label={`${assetRank} ${SUIT_LABELS[card.suit]}`}
      draggable={false}
    />
  );
}
