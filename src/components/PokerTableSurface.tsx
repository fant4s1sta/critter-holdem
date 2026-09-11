"use client";

import { useEffect } from "react";
import { preloadImage } from "@/lib/animal-display";
import { POKER_TABLE_REFERENCE_SRC } from "@/lib/critical-images";

/** Table art is in TABLE_BOOT_ASSET_SRCS — RoomGate waits for it before mount. */
export function PokerTableSurface({ className = "" }: { className?: string }) {
  useEffect(() => {
    void preloadImage(POKER_TABLE_REFERENCE_SRC);
  }, []);

  return (
    <div className={`poker-table-surface ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={POKER_TABLE_REFERENCE_SRC}
        alt="赌场荷官与德州扑克桌面"
        className="poker-table-reference-image select-none"
        draggable={false}
        decoding="sync"
        loading="eager"
      />
    </div>
  );
}
