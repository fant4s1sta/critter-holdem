import type { Card, Rank, Suit } from "./types";
import { preloadImage } from "./animal-display";
import { preloadBrandLogo } from "./critical-images";

export function getCardRenderKey(card: Card, handNumber: number) {
  return `${handNumber}-${card.rank}-${card.suit}`;
}

const SUIT_ASSET_NAMES: Record<Card["suit"], string> = {
  s: "spades",
  h: "hearts",
  d: "diamonds",
  c: "clubs",
};

export function getCardAssetPath(card: Card) {
  const rank = card.rank === "T" ? "10" : card.rank;
  return `/cards/${SUIT_ASSET_NAMES[card.suit]}_${rank}.png`;
}

const preloadCache = new Map<string, Promise<void>>();

export function preloadCardImage(card: Card): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const src = getCardAssetPath(card);
  const cached = preloadCache.get(src);
  if (cached) return cached;

  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => resolve();
    image.onload = done;
    image.onerror = done;
    image.src = src;
    if (image.complete && image.naturalWidth > 0) done();
  });
  preloadCache.set(src, pending);
  return pending;
}

const ALL_RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
];
const ALL_SUITS: Suit[] = ["s", "h", "d", "c"];

export function preloadAllCardImages(): Promise<void> {
  return Promise.all([
    preloadBrandLogo(),
    ...ALL_RANKS.flatMap((rank) =>
      ALL_SUITS.map((suit) => preloadCardImage({ rank, suit })),
    ),
  ]).then(() => undefined);
}

export function revealStepDelay(alreadyRevealed: number, stepMs: number) {
  return alreadyRevealed === 0 ? 0 : stepMs;
}

export const SUIT_LABELS: Record<Card["suit"], string> = {
  s: "黑桃",
  h: "红心",
  d: "方块",
  c: "梅花",
};
