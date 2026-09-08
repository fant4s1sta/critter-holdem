import { assetSrc } from "./asset-src";

/** Side-channel table emotes — not part of room state / revision sync. */

export const EMOTE_COOLDOWN_MS = 2000;
export const EMOTE_DISPLAY_MS = 2200;

/** One WebP sprite (4×2) so picker + bubbles share a single decode. */
export const EMOTE_STICKER_SRC = assetSrc("/emotes/stickers.webp");
export const EMOTE_SPRITE_COLS = 4;
export const EMOTE_SPRITE_ROWS = 2;

/** Sprite cells match public/emotes/stickers.webp (4×2 animal sheet). */
export const TABLE_EMOTES = [
  { id: "big", label: "我牌很大", col: 1, row: 1 },
  { id: "scared", label: "吓坏我了", col: 2, row: 1 },
  { id: "fold", label: "弃牌了", col: 1, row: 0 },
  { id: "allin", label: "All in", col: 2, row: 0 },
  { id: "raise", label: "加注", col: 0, row: 1 },
  { id: "bless", label: "保佑好牌", col: 0, row: 0 },
  { id: "chicken", label: "别偷我鸡", col: 3, row: 1 },
  { id: "junk", label: "什么破牌", col: 3, row: 0 },
] as const;

export type EmoteId = (typeof TABLE_EMOTES)[number]["id"];

const EMOTE_IDS = new Set<string>(TABLE_EMOTES.map((item) => item.id));

export function isEmoteId(value: string): value is EmoteId {
  return EMOTE_IDS.has(value);
}

export function emoteSpritePosition(col: number, row: number): string {
  const x = (col / (EMOTE_SPRITE_COLS - 1)) * 100;
  const y = (row / (EMOTE_SPRITE_ROWS - 1)) * 100;
  return `${x}% ${y}%`;
}

export type SendEmotePayload = {
  code: string;
  playerId: string;
  secret: string;
  emoteId: EmoteId;
};

export type PlayerEmoteEvent = {
  code: string;
  playerId: string;
  emoteId: EmoteId;
  at: number;
};
