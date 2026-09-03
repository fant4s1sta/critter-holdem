import assert from "node:assert/strict";
import {
  computeViewerActionHints,
  getViewerCallAmount,
  recomputeViewerYou,
  viewerCanCheck,
} from "./player-action-ui";
import { mergeRoomPatch, diffRoomState } from "./room-state-sync";
import type { RoomPublicState } from "./types";

function baseRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "123456",
    rev: 1,
    status: "playing",
    gameType: "texas-holdem",
    ruleMode: "classic",
    hostId: "host",
    maxPlayers: 10,
    players: [
      {
        id: "p1",
        name: "A",
        avatarId: "dog",
        seat: 0,
        chips: 980,
        connected: true,
        away: false,
        aiControlled: false,
        isHost: true,
        betThisStreet: 20,
        holeCardCount: 2,
      },
    ],
    you: {
      playerId: "p1",
      seat: 0,
      spectator: false,
      canAct: true,
      callAmount: 20,
      minRaiseTo: 40,
      maxRaiseTo: 1000,
    },
    game: {
      gameType: "texas-holdem",
      handNumber: 1,
      street: "preflop",
      communityCards: [],
      pot: 50,
      currentBet: 20,
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
    ...overrides,
  };
}

{
  const room = baseRoom();
  assert.equal(getViewerCallAmount(room), 0);
  assert.equal(viewerCanCheck(room), true);
}

{
  const room = baseRoom({
    players: [{ ...baseRoom().players[0], betThisStreet: 0 }],
    game: { ...baseRoom().game!, currentBet: 20 },
    you: { ...baseRoom().you!, callAmount: 20 },
  });
  assert.equal(getViewerCallAmount(room), 20);
  assert.equal(viewerCanCheck(room), false);
}

{
  const prev = baseRoom();
  const next = baseRoom({
    rev: 2,
    game: { ...prev.game!, street: "flop", currentBet: 0, actingPlayerId: "p1" },
    you: { ...prev.you!, canAct: true, callAmount: 0, minRaiseTo: 20, maxRaiseTo: 1000 },
    players: [{ ...prev.players[0], betThisStreet: 0, chips: 980 }],
  });
  const patch = diffRoomState(prev, next, 2);
  assert.ok(patch?.you);
  assert.equal(patch!.you!.callAmount, 0);

  const stale = mergeRoomPatch(
    { ...prev, you: { ...prev.you!, callAmount: 20, canAct: true } },
    { rev: 2, code: "123456", game: { street: "flop", currentBet: 0, actingPlayerId: "p1" } },
  );
  assert.equal(stale.game?.currentBet, 0);
  assert.equal(getViewerCallAmount(stale), 0);
  assert.equal(stale.you?.callAmount, 0);
}

{
  const prev = baseRoom();
  const merged = mergeRoomPatch(
    { ...prev, you: { ...prev.you!, callAmount: 20 } },
    {
      rev: 2,
      code: "123456",
      players: [{ id: "p1", betThisStreet: 20 }],
      game: { actingPlayerId: "p1", lastAction: prev.game!.lastAction },
    },
  );
  assert.equal(computeViewerActionHints(merged)?.callAmount, 0);
  assert.equal(merged.you?.callAmount, 0);
}

{
  const prev = baseRoom({
    players: [{ ...baseRoom().players[0], betThisStreet: undefined }],
    you: { ...baseRoom().you!, callAmount: 20 },
    game: { ...baseRoom().game!, currentBet: 0 },
  });
  const fixed = recomputeViewerYou(prev);
  assert.equal(fixed.you?.callAmount, 0);
}

console.log("player-action-ui.test.ts ok");
