/** Side-channel table emotes — not part of room state / revision sync. */

export const EMOTE_COOLDOWN_MS = 2000;
export const EMOTE_DISPLAY_MS = 2200;

export const TABLE_EMOTES = [
  { id: "grin", emoji: "😀", label: "开心" },
  { id: "joy", emoji: "😂", label: "大笑" },
  { id: "cool", emoji: "😎", label: "帅气" },
  { id: "shock", emoji: "😱", label: "震惊" },
  { id: "fire", emoji: "🔥", label: "火热" },
  { id: "clap", emoji: "👏", label: "鼓掌" },
  { id: "think", emoji: "🤔", label: "思考" },
  { id: "party", emoji: "🎉", label: "庆祝" },
] as const;

export type EmoteId = (typeof TABLE_EMOTES)[number]["id"];

const EMOTE_IDS = new Set<string>(TABLE_EMOTES.map((item) => item.id));

export function isEmoteId(value: string): value is EmoteId {
  return EMOTE_IDS.has(value);
}

export function emojiForEmoteId(id: string): string | null {
  return TABLE_EMOTES.find((item) => item.id === id)?.emoji ?? null;
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
  emoji: string;
  at: number;
};
