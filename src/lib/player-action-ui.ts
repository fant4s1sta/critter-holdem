import type { RoomPublicState } from "./types";

function viewerMe(room: RoomPublicState) {
  const you = room.you;
  if (!you || you.spectator) return null;
  return room.players.find((player) => player.id === you.playerId) ?? null;
}

/** Derive call / raise bounds from merged table + seat state (never stale you.callAmount). */
export function computeViewerActionHints(room: RoomPublicState) {
  const you = room.you;
  const me = viewerMe(room);
  if (!you || !me || !room.game) return null;

  const betThisStreet = me.betThisStreet ?? 0;
  const toCall = Math.max(0, room.game.currentBet - betThisStreet);
  const callAmount = Math.min(toCall, me.chips);
  const minRaiseTo = Math.min(
    room.game.currentBet + room.game.minRaise,
    me.chips + betThisStreet,
  );
  const maxRaiseTo = me.chips + betThisStreet;

  return { callAmount, minRaiseTo, maxRaiseTo };
}

/** Re-sync you.callAmount / raise bounds after patch merge. */
export function recomputeViewerYou(room: RoomPublicState): RoomPublicState {
  const you = room.you;
  const hints = computeViewerActionHints(room);
  if (!you || !hints) return room;

  if (
    you.callAmount === hints.callAmount &&
    you.minRaiseTo === hints.minRaiseTo &&
    you.maxRaiseTo === hints.maxRaiseTo
  ) {
    return room;
  }

  return { ...room, you: { ...you, ...hints } };
}

/** Amount the viewer must put in to continue (0 = may check). */
export function getViewerCallAmount(room: RoomPublicState): number {
  return computeViewerActionHints(room)?.callAmount ?? room.you?.callAmount ?? 0;
}

export function viewerCanCheck(room: RoomPublicState): boolean {
  return getViewerCallAmount(room) === 0;
}
