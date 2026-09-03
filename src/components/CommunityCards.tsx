"use client";

import { useEffect } from "react";
import type { Card } from "@/lib/types";
import { preloadCardImage } from "@/lib/card-visuals";
import { useSequentialReveal } from "@/lib/use-sequential-reveal";
import {
  CommunityCardSlot,
  communitySlotMode,
} from "./CommunityCardSlot";

export function CommunityCards({
  cards,
  handNumber,
}: {
  cards: Card[];
  handNumber: number;
}) {
  const revealed = useSequentialReveal(cards, handNumber, 90);

  useEffect(() => {
    for (const card of cards) {
      void preloadCardImage(card);
    }
  }, [cards, handNumber]);

  return (
    <div className="community-cards" aria-label="公共牌">
      {[0, 1, 2, 3, 4].map((index) => {
        const card = index < cards.length ? cards[index] : undefined;
        const mode = communitySlotMode(index, cards, revealed);

        return (
          <CommunityCardSlot
            key={`community-${handNumber}-${index}`}
            mode={mode}
            card={card}
            slotIndex={index}
          />
        );
      })}
    </div>
  );
}
