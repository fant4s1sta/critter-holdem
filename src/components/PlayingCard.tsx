"use client";

import type { Card } from "@/lib/types";
import { CardBack } from "@/components/CardBack";
import { CardFaceSvg } from "@/components/CardFaceSvg";

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

  return (
    <CardFaceSvg
      card={card}
      className={`${motionClass}${sizeClass}`.trim()}
      dealDelay={dealDelay}
    />
  );
}
