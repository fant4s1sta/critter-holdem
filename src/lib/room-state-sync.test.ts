import assert from "node:assert/strict";
import {
  diffRoomState,
  mergeRoomPatch,
  shouldForceFullSync,
} from "./room-state-sync";
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
      handNumber: 1,
      street: "preflop",
      communityCards: [],
      pot: 30,
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
  const prev = baseRoom();
  const next = baseRoom({
    rev: 2,
    game: { ...prev.game!, pot: 50, actingPlayerId: "p2" },
    you: { ...prev.you!, canAct: false, callAmount: 20 },
    players: [{ ...prev.players[0], chips: 980, betThisStreet: 20 }],
  });

  const patch = diffRoomState(prev, next, 2);
  assert.ok(patch);
  assert.equal(patch!.game?.pot, 50);
  assert.equal(patch!.players?.length, 1);
  assert.equal(patch!.players?.[0].chips, 980);

  const merged = mergeRoomPatch(prev, patch!);
  assert.equal(merged.game?.pot, 50);
  assert.equal(merged.players[0].chips, 980);
  assert.equal(merged.you?.canAct, false);
}

{
  const prev = baseRoom();
  const next = baseRoom({ status: "finished", game: null });
  assert.equal(shouldForceFullSync(prev, next), true);
}

console.log("room-state-sync.test.ts ok");
