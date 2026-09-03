"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "./types";
import { preloadCardImage, revealStepDelay } from "./card-visuals";

export function useSequentialReveal(
  cards: Card[],
  resetKey: number,
  stepMs: number,
) {
  const [revealed, setRevealed] = useState(0);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const signature = cards.map((card) => `${card.rank}${card.suit}`).join("-");

  useEffect(() => {
    setRevealed(0);
  }, [resetKey]);

  useEffect(() => {
    const list = cardsRef.current;
    if (revealed > list.length) {
      setRevealed(list.length);
      return;
    }
    if (revealed >= list.length) return;
    const card = list[revealed];
    if (!card) return;

    let cancelled = false;
    let timer = 0;
    preloadCardImage(card).then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (!cancelled) setRevealed((count) => count + 1);
      }, revealStepDelay(revealed, stepMs));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [resetKey, revealed, signature, stepMs]);

  return Math.min(revealed, cards.length);
}
