export interface SeatLayoutPlayer {
  id: string;
  seat: number;
}

export interface SeatLayoutSlot<T extends SeatLayoutPlayer> {
  player: T;
  x: number;
  y: number;
  /** Index into TABLE_SEAT_CUPS (rail seat markers). */
  cupIndex: number;
}

/** Seat anchors matching the portrait, angled table artwork. */
export const TABLE_SEAT_CUPS: ReadonlyArray<readonly [number, number]> = [
  [0.28, 0.34], // 0 upper-left
  [0.13, 0.39], // 1 left-upper
  [0.05, 0.55], // 2 left-middle
  [0.10, 0.71], // 3 left-lower
  [0.27, 0.82], // 4 lower-left
  [0.73, 0.82], // 5 lower-right
  [0.90, 0.71], // 6 right-lower
  [0.95, 0.55], // 7 right-middle
  [0.87, 0.39], // 8 right-upper
  [0.72, 0.34], // 9 upper-right
];

/** Seat 0 = dealer's left; seats 1…9 continue counter-clockwise (10-max). */
export const SEAT_TO_CUP: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Lobby standee sits in the felt pocket between lower-left (4) and lower-right (5). */
export const LOBBY_STANDEE_ANCHOR = {
  x: ((TABLE_SEAT_CUPS[4][0] + TABLE_SEAT_CUPS[5][0]) / 2) * 100,
  y: TABLE_SEAT_CUPS[4][1] * 100,
} as const;

const SEAT_COUNT = TABLE_SEAT_CUPS.length;

function roundCoord(value: number) {
  return Math.round(value * 10) / 10;
}

function cupToPercent(cupIndex: number): { x: number; y: number } {
  const [nx, ny] = TABLE_SEAT_CUPS[((cupIndex % SEAT_COUNT) + SEAT_COUNT) % SEAT_COUNT];
  return {
    x: roundCoord(nx * 100),
    y: roundCoord(ny * 100),
  };
}

function cupForSeat(seat: number): number {
  return SEAT_TO_CUP[seat] ?? SEAT_TO_CUP[0];
}

/**
 * Fixed rail positions by seat number. Dealer / blind badges rotate; avatars stay put.
 */
export function getSeatLayout<T extends SeatLayoutPlayer>(
  players: T[],
): SeatLayoutSlot<T>[] {
  return [...players]
    .sort((a, b) => a.seat - b.seat)
    .map((player) => {
      const cupIndex = cupForSeat(player.seat);
      const { x, y } = cupToPercent(cupIndex);
      return { player, x, y, cupIndex };
    });
}

/** Top badge for small / big blind only. */
export function seatBadgeForSeat(
  seat: number,
  game:
    | {
        smallBlindSeat: number;
        bigBlindSeat: number;
      }
    | null
    | undefined,
): { label: string; tone: "sb" | "bb" } | null {
  if (!game) return null;
  if (seat === game.bigBlindSeat) return { label: "大盲", tone: "bb" };
  if (seat === game.smallBlindSeat) return { label: "小盲", tone: "sb" };
  return null;
}
