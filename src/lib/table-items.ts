import { assetSrc } from "./asset-src";

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
  return assetSrc(`/items/${id}.webp`);
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
};

export function itemFlightPath(from: RectLike, to: RectLike): ItemFlightPath {
  return {
    x0: from.left + from.width / 2,
    y0: from.top + from.height / 2,
    x1: to.left + to.width / 2,
    y1: to.top + to.height / 2,
  };
}

/** Map a viewport-space rect into an element's unscaled local box. */
export function mapViewportRectToElement(
  rect: RectLike,
  elementRect: RectLike,
  elementWidth: number,
  elementHeight: number,
): RectLike {
  const sx = elementWidth / elementRect.width;
  const sy = elementHeight / elementRect.height;
  return {
    left: (rect.left - elementRect.left) * sx,
    top: (rect.top - elementRect.top) * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  };
}

export type ItemFlightPercentPath = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  size: number;
};

/** Straight avatar-to-avatar path as % of the overlay's visible box. */
export function itemFlightPercentPath(
  from: RectLike,
  to: RectLike,
  frame: RectLike,
): ItemFlightPercentPath {
  if (!(frame.width > 0) || !(frame.height > 0)) {
    return { x0: 0, y0: 0, x1: 0, y1: 0, size: 8 };
  }
  const fromX = from.left + from.width / 2;
  const fromY = from.top + from.height / 2;
  const toX = to.left + to.width / 2;
  const toY = to.top + to.height / 2;
  return {
    x0: ((fromX - frame.left) / frame.width) * 100,
    y0: ((fromY - frame.top) / frame.height) * 100,
    x1: ((toX - frame.left) / frame.width) * 100,
    y1: ((toY - frame.top) / frame.height) * 100,
    size: Math.max(5, Math.min(12, (((from.width + to.width) / 2) / frame.width) * 70)),
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
