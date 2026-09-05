import type { AnimalId, Card, Rank, Suit } from "./types";

export const SUIT_LABELS: Record<Suit, string> = {
  s: "黑桃",
  h: "红心",
  d: "方块",
  c: "梅花",
};

export const SUIT_COLORS: Record<Suit, string> = {
  s: "#1a1a1a",
  c: "#3f8f5a",
  h: "#d2202a",
  d: "#e8781a",
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

/**
 * Suit glyph paths in a 0..100 viewBox.
 * Spade tip points up; heart tip points down; diamond is a tall rhombus;
 * club is three lobes + flared stem — matched to a standard suit reference.
 */
export const SUIT_PATHS: Record<Suit, string> = {
  s: [
    "M50 4",
    "C28 28 8 42 8 62",
    "C8 78 22 90 38 90",
    "C44 90 48 86 50 80",
    "C52 86 56 90 62 90",
    "C78 90 92 78 92 62",
    "C92 42 72 28 50 4Z",
    "M43 86",
    "C45 94 47 100 50 100",
    "C53 100 55 94 57 86",
    "C53 90 47 90 43 86Z",
  ].join(""),
  h: [
    "M50 96",
    "C22 72 4 54 4 34",
    "C4 16 18 4 34 4",
    "C42 4 48 8 50 14",
    "C52 8 58 4 66 4",
    "C82 4 96 16 96 34",
    "C96 54 78 72 50 96Z",
  ].join(""),
  d: "M50 2L90 50 50 98 10 50Z",
  c: [
    "M50 12",
    "C38 12 28 22 28 34",
    "C28 46 38 56 50 56",
    "C62 56 72 46 72 34",
    "C72 22 62 12 50 12Z",
    "M28 40",
    "C16 40 6 50 6 62",
    "C6 74 16 84 28 84",
    "C40 84 50 74 50 62",
    "C50 50 40 40 28 40Z",
    "M72 40",
    "C60 40 50 50 50 62",
    "C50 74 60 84 72 84",
    "C84 84 94 74 94 62",
    "C94 50 84 40 72 40Z",
    "M43 78",
    "C45 88 47 98 50 100",
    "C53 98 55 88 57 78",
    "C53 84 47 84 43 78Z",
  ].join(""),
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

/** Court-card animal portraits: J=cat, Q=rabbit, K=fox. */
export const FACE_CARD_ANIMAL: Record<"J" | "Q" | "K", AnimalId> = {
  J: "cat",
  Q: "rabbit",
  K: "fox",
};

export function faceCardAnimal(rank: Rank): AnimalId | null {
  if (rank === "J" || rank === "Q" || rank === "K") {
    return FACE_CARD_ANIMAL[rank];
  }
  return null;
}
