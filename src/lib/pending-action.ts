import type { GameActionPayload, RoomPublicState } from "./types";

/** A bet/fold the viewer sent that the table has not yet reflected. */
export type PendingAction = {
  action: GameActionPayload;
  handNumber: number;
  actingPlayerId: string | null;
  at: number;
};

/** Give up on the optimistic lock if nothing comes back in this window. */
export const PENDING_ACTION_TIMEOUT_MS = 4_000;

export function createPendingAction(
  room: RoomPublicState,
  action: GameActionPayload,
  at = Date.now(),
): PendingAction {
  return {
    action,
    handNumber: room.game?.handNumber ?? 0,
    actingPlayerId: room.game?.actingPlayerId ?? null,
    at,
  };
}

/**
 * The table moved on (turn passed, new hand, or we lost the right to act) —
 * the pending action either landed or is no longer relevant.
 */
export function pendingActionResolved(
  pending: PendingAction,
  room: RoomPublicState | null,
): boolean {
  if (!room) return false;
  if (room.status !== "playing" || !room.game) return true;
  if (room.game.handNumber !== pending.handNumber) return true;
  if (room.game.actingPlayerId !== pending.actingPlayerId) return true;
  return !room.you?.canAct;
}

/** Whether the action panel should accept input right now. */
export function canSubmitAction(
  room: RoomPublicState | null,
  pending: PendingAction | null,
): boolean {
  if (!room?.you?.canAct) return false;
  return pending === null;
}
