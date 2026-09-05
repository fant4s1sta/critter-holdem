import type { Card, Rank, Suit } from "./types";

export const SUIT_LABELS: Record<Suit, string> = {
  s: "黑桃",
  h: "红心",
  d: "方块",
  c: "梅花",
};

export const SUIT_COLORS: Record<Suit, string> = {
  s: "#1a1a1a",
  c: "#1a1a1a",
  h: "#d2202a",
  d: "#d2202a",
};

export function rankLabel(rank: Rank): string {
  return rank === "T" ? "10" : rank;
}

export function getCardRenderKey(card: Card, handNumber: number) {
  return `${handNumber}-${card.rank}-${card.suit}`;
}

export function revealStepDelay(alreadyRevealed: number, stepMs: number) {
  return alreadyRevealed === 0 ? 0 : stepMs;
}

/** SVG cards need no network decode — kept for call-site compatibility. */
export function preloadCardImage(_card?: Card): Promise<void> {
  void _card;
  return Promise.resolve();
}

export function preloadAllCardImages(): Promise<void> {
  return Promise.resolve();
}

/** Suit glyph paths in a 0..100 viewBox, tip facing down for hearts/spades. */
export const SUIT_PATHS: Record<Suit, string> = {
  s: "M50 6C42 22 18 34 18 54c0 12 9 20 20 20 5 0 9-2 12-5 3 3 7 5 12 5 11 0 20-8 20-20 0-20-24-32-32-48zM40 74c1 8 2 16 2 20h16c0-4 1-12 2-20H40z",
  h: "M50 92C50 92 10 64 10 38 10 22 22 12 36 12c8 0 14 4 14 10 0-6 6-10 14-10 14 0 26 10 26 26 0 26-40 54-40 54z",
  d: "M50 8L86 50 50 92 14 50z",
  c: "M50 28c-10 0-18 8-18 18 0 7 4 13 10 16-8 3-14 10-14 18h24c0-4 2-8 6-10v24h8V70c4 2 6 6 6 10h24c0-8-6-15-14-18 6-3 10-9 10-16 0-10-8-18-18-18-4 0-8 1-11 4-3-3-7-4-11-4z",
};

export type Pip = { x: number; y: number; flip?: boolean; scale?: number };

/**
 * Pip positions in card viewBox coordinates (242 × 340).
 * Bottom-half pips are flipped so tips stay upright relative to the player.
 */
export function pipLayout(rank: Rank): Pip[] {
  const L = 78;
  const R = 164;
  const C = 121;
  const T = 78;
  const M1 = 118;
  const M2 = 170;
  const M3 = 222;
  const B = 262;

  switch (rank) {
    case "A":
      return [{ x: C, y: 170, scale: 1.55 }];
    case "2":
      return [
        { x: C, y: T },
        { x: C, y: B, flip: true },
      ];
    case "3":
      return [
        { x: C, y: T },
        { x: C, y: 170 },
        { x: C, y: B, flip: true },
      ];
    case "4":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "5":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: 170 },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "6":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: 170 },
        { x: R, y: 170 },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "7":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: M1 },
        { x: L, y: 170 },
        { x: R, y: 170 },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "8":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: M1 },
        { x: L, y: 170 },
        { x: R, y: 170 },
        { x: C, y: M3, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "9":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: L, y: M1 },
        { x: R, y: M1 },
        { x: C, y: 170 },
        { x: L, y: M3, flip: true },
        { x: R, y: M3, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    case "T":
      return [
        { x: L, y: T },
        { x: R, y: T },
        { x: C, y: 98 },
        { x: L, y: M1 },
        { x: R, y: M1 },
        { x: L, y: M3, flip: true },
        { x: R, y: M3, flip: true },
        { x: C, y: M2 + 44, flip: true },
        { x: L, y: B, flip: true },
        { x: R, y: B, flip: true },
      ];
    default:
      return [];
  }
}

export function isFaceRank(rank: Rank): boolean {
  return rank === "J" || rank === "Q" || rank === "K";
}
