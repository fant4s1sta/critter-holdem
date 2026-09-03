import assert from "node:assert/strict";
import { TexasHoldemEngine } from "./engine";

function main() {
  const original = new TexasHoldemEngine({ turnMs: 5_000 });
  original.startHand([
    { id: "p1", name: "玩家一", seat: 0, chips: 1_000, away: false },
    { id: "p2", name: "玩家二", seat: 1, chips: 1_000, away: false },
  ]);

  const restored = TexasHoldemEngine.fromSnapshot(original.toSnapshot());
  assert.deepEqual(restored.toSnapshot(), original.toSnapshot());
  assert.deepEqual(restored.toPublic(), original.toPublic());
  assert.deepEqual(restored.holeCardsFor("p1"), original.holeCardsFor("p1"));

  const actingPlayerId = restored.players.find(
    (player) => player.seat === restored.actingSeat,
  )?.id;
  assert.ok(actingPlayerId);
  restored.applyAction(actingPlayerId, "fold");
  assert.equal(restored.handOver, true);
  assert.equal(restored.winners?.length, 1);

  console.log("engine persistence tests passed");
}

main();
