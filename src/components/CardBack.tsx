"use client";

import { BrandLogo } from "./BrandLogo";

export function CardBack({
  sizeClass = "playing-card",
  dealDelay = 0,
  animate = true,
}: {
  sizeClass?: string;
  dealDelay?: number;
  animate?: boolean;
}) {
  return (
    <div
      className={`${animate ? "card-deal " : ""}card-back ${sizeClass}`.trim()}
      style={{ animationDelay: `${dealDelay}ms` }}
      aria-label="牌背"
    >
      <BrandLogo variant="card-back" />
    </div>
  );
}
