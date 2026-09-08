import assert from "node:assert/strict";
import {
  canSubmitAction,
  createPendingAction,
  pendingActionResolved,
} from "./pending-action";
import { diffRoomState, mergeRoomPatch } from "./room-state-sync";
import {
  recordServerClock,
  resetServerClockForTests,
  serverClockOffsetMs,
  serverNow,
} from "./server-clock";
import type { RoomPublicState } from "./types";

function baseRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "123456",
    rev: 1,
    status: "playing",
    gameType: "texas-holdem",
    ruleMode: "classic",
    hostId: "p1",
    maxPlayers: 10,
    players: [
      {
        id: "p1",
        name: "A",
        avatarId: "dog",
        seat: 0,
        chips: 1000,
        connected: true,
        away: false,
        aiControlled: false,
        isHost: true,
        holeCardCount: 2,
      },
    ],
    you: {
      playerId: "p1",
      seat: 0,
      spectator: false,
      canAct: true,
      callAmount: 0,
      minRaiseTo: 20,
      maxRaiseTo: 1000,
    },
    game: {
      gameType: "texas-holdem",
      handNumber: 3,
      street: "flop",
      communityCards: [],
      pot: 30,
      currentBet: 0,
      minRaise: 20,
      dealerSeat: 0,
      smallBlindSeat: 0,
      bigBlindSeat: 1,
      actingSeat: 0,
      actingPlayerId: "p1",
      turnEndsAt: null,
      smallBlind: 10,
      bigBlind: 20,
    },
    serverNow: 1_000_000,
    ...overrides,
  };
}

// --- pending action lock ---------------------------------------------------
{
  const room = baseRoom();
  const pending = createPendingAction(room, { type: "check" }, 42);
  assert.equal(pending.handNumber, 3);
  assert.equal(pending.actingPlayerId, "p1");
  assert.equal(pending.at, 42);

  assert.equal(canSubmitAction(room, null), true);
  assert.equal(canSubmitAction(room, pending), false, "locked while pending");
  assert.equal(
    canSubmitAction({ ...room, you: { ...room.you!, canAct: false } }, null),
    false,
  );
  assert.equal(canSubmitAction(null, null), false);
}

{
  const room = baseRoom();
  const pending = createPendingAction(room, { type: "call" });

  assert.equal(pendingActionResolved(pending, room), false, "same turn still pending");
  assert.equal(pendingActionResolved(pending, null), false, "no room yet → keep lock");

  const turnPassed = baseRoom({
    game: { ...room.game!, actingPlayerId: "p2" },
    you: { ...room.you!, canAct: false },
  });
  assert.equal(pendingActionResolved(pending, turnPassed), true);

  const newHand = baseRoom({ game: { ...room.game!, handNumber: 4 } });
  assert.equal(pendingActionResolved(pending, newHand), true);

  const lostRight = baseRoom({ you: { ...room.you!, canAct: false } });
  assert.equal(pendingActionResolved(pending, lostRight), true);

  const finished = baseRoom({ status: "finished", game: null });
  assert.equal(pendingActionResolved(pending, finished), true);
}

// --- serverNow rides along with patches ------------------------------------
{
  const prev = baseRoom();
  const next = baseRoom({
    rev: 2,
    serverNow: 1_000_500,
    game: { ...prev.game!, pot: 60 },
  });
  const patch = diffRoomState(prev, next, 2);
  assert.ok(patch);
  assert.equal(patch!.serverNow, 1_000_500);
  const merged = mergeRoomPatch(prev, patch!);
  assert.equal(merged.serverNow, 1_000_500);

  // No table change → no patch, even though the clock ticked.
  assert.equal(diffRoomState(prev, baseRoom({ serverNow: 1_000_900 }), 2), null);
}

// --- server clock calibration ----------------------------------------------
{
  resetServerClockForTests();
  assert.equal(serverClockOffsetMs(), 0);
  assert.equal(serverNow(5_000), 5_000);

  recordServerClock(undefined, 10_000);
  assert.equal(serverClockOffsetMs(), 0, "ignores missing sample");

  // Phone clock is 3s fast → offset negative, first sample taken as-is.
  recordServerClock(10_000, 13_000);
  assert.equal(serverClockOffsetMs(), -3_000);
  assert.equal(serverNow(13_000), 10_000);

  // Later samples are smoothed, not snapped.
  recordServerClock(20_000, 23_000 - 1_000);
  const offset = serverClockOffsetMs();
  assert.ok(offset > -3_000 && offset < -2_000, `smoothed offset, got ${offset}`);

  resetServerClockForTests();
}

console.log("pending-action / server-clock tests passed");
