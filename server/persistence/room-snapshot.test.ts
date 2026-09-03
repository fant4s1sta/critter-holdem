import assert from "node:assert/strict";
import { createHandSkillState } from "../games/skill-mode/skill-runtime";
import { TexasHoldemEngine } from "../games/texas-holdem/engine";
import type { Room } from "../room-manager";
import { restoreRoom, serializeRoom } from "./room-snapshot";

function main() {
  const disconnectTimer = setTimeout(() => undefined, 60_000);
  const engine = new TexasHoldemEngine();
  engine.startHand([
    { id: "p1", name: "玩家一", seat: 0, chips: 1_000, away: false },
    { id: "p2", name: "玩家二", seat: 1, chips: 1_000, away: false },
  ]);
  const room: Room = {
    code: "123456",
    hostId: "p1",
    gameType: "texas-holdem",
    ruleMode: "skill",
    status: "playing",
    maxPlayers: 10,
    minPlayers: 2,
    players: new Map([
      [
        "p1",
        {
          id: "p1",
          secret: "secret",
          name: "玩家一",
          avatarId: "dog",
          seat: 0,
          chips: 1_000,
          connected: true,
          away: false,
          isBot: false,
          isHost: true,
          spectator: false,
          socketId: "socket-1",
          disconnectTimer,
        },
      ],
    ]),
    spectators: new Map(),
    spectatorSockets: new Map([["spectator", "socket-2"]]),
    engine,
    skillHand: createHandSkillState(),
    lastStreet: "preflop",
    createdAt: Date.now(),
    nextHandAt: Date.now() + 5_000,
  };

  const snapshot = serializeRoom(room, 3);
  const json = JSON.stringify(snapshot);
  assert.equal(json.includes("socket-1"), false);
  assert.equal(json.includes("socket-2"), false);
  assert.equal(json.includes("disconnectTimer"), false);
  assert.equal(snapshot.rev, 3);

  const restored = restoreRoom(snapshot);
  assert.equal(restored.spectatorSockets.size, 0);
  assert.equal(restored.players.get("p1")?.socketId, undefined);
  assert.deepEqual(restored.engine?.toSnapshot(), engine.toSnapshot());
  assert.deepEqual(restored.skillHand?.usedActive, new Set());
  clearTimeout(disconnectTimer);

  console.log("room snapshot tests passed");
}

main();
