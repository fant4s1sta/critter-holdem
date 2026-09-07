/** Side-channel table emotes — not part of room state / revision sync. */

export const EMOTE_COOLDOWN_MS = 2000;
export const EMOTE_DISPLAY_MS = 2200;

/** One WebP sprite (5×4) so picker + bubbles share a single decode. */
export const EMOTE_STICKER_SRC = "/emotes/stickers.webp";
export const EMOTE_SPRITE_COLS = 5;
export const EMOTE_SPRITE_ROWS = 4;

export const TABLE_EMOTES = [
  { id: "shades", label: "墨镜", col: 0, row: 0 },
  { id: "heart", label: "比心", col: 1, row: 0 },
  { id: "cry", label: "大哭", col: 2, row: 0 },
  { id: "knife", label: "菜刀", col: 3, row: 0 },
  { id: "pray", label: "上香", col: 4, row: 0 },
  { id: "love", label: "花痴", col: 0, row: 1 },
  { id: "giggle", label: "偷笑", col: 1, row: 1 },
  { id: "thumbsup", label: "点赞", col: 2, row: 1 },
  { id: "cheer", label: "加油", col: 3, row: 1 },
  { id: "point", label: "指你", col: 4, row: 1 },
  { id: "grin", label: "嘿嘿", col: 0, row: 2 },
  { id: "joy", label: "大笑", col: 1, row: 2 },
  { id: "shock", label: "震惊", col: 2, row: 2 },
  { id: "shout", label: "怒吼", col: 3, row: 2 },
  { id: "imp", label: "小恶魔", col: 4, row: 2 },
  { id: "meh", label: "无语", col: 0, row: 3 },
  { id: "peace", label: "耶", col: 1, row: 3 },
  { id: "smile", label: "咧嘴", col: 2, row: 3 },
  { id: "wink", label: "调皮", col: 3, row: 3 },
  { id: "kiss", label: "飞吻", col: 4, row: 3 },
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
