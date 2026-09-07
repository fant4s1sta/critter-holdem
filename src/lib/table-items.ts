/** Side-channel table items — not part of room state / revision sync. */

export const ITEM_HIT_MS = 2600;
export const ITEM_FLIGHT_MS = 520;
export const ITEM_IMPACT_LEAD_MS = 830;

export const TABLE_ITEMS = [
  { id: "bomb", label: "炸弹" },
  { id: "egg", label: "鸡蛋" },
  { id: "tomato", label: "番茄" },
  { id: "heart", label: "爱心" },
] as const;

export type TableItemId = (typeof TABLE_ITEMS)[number]["id"];

const ITEM_IDS = new Set<string>(TABLE_ITEMS.map((item) => item.id));

export function isTableItemId(value: string): value is TableItemId {
  return ITEM_IDS.has(value);
}

export function tableItemSrc(id: TableItemId): string {
  return `/items/${id}.webp`;
}

export const TABLE_ITEM_SRCS = TABLE_ITEMS.map((item) => tableItemSrc(item.id));

export type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ItemFlightPath = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mx: number;
  my: number;
};

export function itemFlightArcPx(dx: number, dy: number): number {
  const dist = Math.hypot(dx, dy);
  return -Math.min(64, Math.max(22, dist * 0.2));
}

export function itemFlightPath(from: RectLike, to: RectLike): ItemFlightPath {
  const x0 = from.left + from.width / 2;
  const y0 = from.top + from.height / 2;
  const x1 = to.left + to.width / 2;
  const y1 = to.top + to.height / 2;
  return {
    x0,
    y0,
    x1,
    y1,
    mx: (x0 + x1) / 2,
    my: (y0 + y1) / 2 + itemFlightArcPx(x1 - x0, y1 - y0),
  };
}

export type ThrowItemPayload = {
  code: string;
  playerId: string;
  secret: string;
  targetPlayerId: string;
  itemId: TableItemId;
};

export type PlayerItemEvent = {
  code: string;
  fromPlayerId: string;
  targetPlayerId: string;
  itemId: TableItemId;
  at: number;
};

export type SeatItemFlight = {
  fromPlayerId: string;
  targetPlayerId: string;
  itemId: TableItemId;
  at: number;
};
