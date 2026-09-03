import assert from "node:assert/strict";
import { evaluateBestHand } from "./hand-eval";
import { TexasHoldemEngine } from "./engine";
import type { Card } from "../../../src/lib/types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

{
  const royal = evaluateBestHand([
    c("A", "s"),
    c("K", "s"),
    c("Q", "s"),
    c("J", "s"),
    c("T", "s"),
    c("2", "h"),
    c("3", "d"),
  ]);
  assert.equal(royal.name, "皇家同花顺");
}

{
  const pair = evaluateBestHand([
    c("A", "s"),
    c("A", "h"),
    c("2", "d"),
    c("5", "c"),
    c("9", "s"),
  ]);
  assert.equal(pair.name, "一对");
}

{
  const engine = new TexasHoldemEngine({ turnMs: 60_000 });
  const seated = Array.from({ length: 10 }, (_, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    chips: 1000,
    away: false,
  }));
  const rotations: { d: number; sb: number; bb: number }[] = [];
  for (let h = 0; h < 20; h++) {
    engine.startHand(seated);
    rotations.push({
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    });
  }
  assert.deepEqual(rotations.slice(0, 10), [
    { d: 9, sb: 0, bb: 1 },
    { d: 0, sb: 1, bb: 2 },
    { d: 1, sb: 2, bb: 3 },
    { d: 2, sb: 3, bb: 4 },
    { d: 3, sb: 4, bb: 5 },
    { d: 4, sb: 5, bb: 6 },
    { d: 5, sb: 6, bb: 7 },
    { d: 6, sb: 7, bb: 8 },
    { d: 7, sb: 8, bb: 9 },
    { d: 8, sb: 9, bb: 0 },
  ]);
  assert.deepEqual(rotations[10], rotations[0]);
  for (const r of rotations) {
    assert.notEqual(r.sb, r.bb);
    assert.notEqual(r.d, r.bb);
    assert.notEqual(r.d, r.sb);
  }
}

{
  const engine = new TexasHoldemEngine({ turnMs: 60_000 });
  const seated = Array.from({ length: 8 }, (_, seat) => ({
    id: `p${seat}`,
    name: `P${seat}`,
    seat,
    chips: 1000,
    away: false,
  }));
  engine.startHand(seated);
  assert.deepEqual(
    {
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    },
    { d: 7, sb: 0, bb: 1 },
  );
}

{
  const engine = new TexasHoldemEngine({ turnMs: 60_000 });
  const seated = [
    { id: "a", name: "A", seat: 0, chips: 1000, away: false },
    { id: "b", name: "B", seat: 1, chips: 1000, away: false },
  ];
  engine.startHand(seated);
  assert.deepEqual(
    {
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    },
    { d: 0, sb: 0, bb: 1 },
  );
  engine.startHand(seated);
  assert.deepEqual(
    {
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    },
    { d: 1, sb: 1, bb: 0 },
  );
}

{
  const engine = new TexasHoldemEngine({ turnMs: 60_000 });
  const seated = [
    { id: "a", name: "A", seat: 0, chips: 1000, away: false },
    { id: "b", name: "B", seat: 2, chips: 1000, away: false },
    { id: "c", name: "C", seat: 5, chips: 1000, away: false },
  ];
  engine.startHand(seated);
  assert.deepEqual(
    {
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    },
    { d: 5, sb: 0, bb: 2 },
  );
  engine.startHand(seated);
  assert.deepEqual(
    {
      d: engine.dealerSeat,
      sb: engine.smallBlindSeat,
      bb: engine.bigBlindSeat,
    },
    { d: 0, sb: 2, bb: 5 },
  );
}

{
  const engine = new TexasHoldemEngine({ turnMs: 60_000 });
  engine.startHand([
    { id: "a", name: "Straight", seat: 0, chips: 1000, away: false },
    { id: "b", name: "Pair", seat: 1, chips: 1000, away: false },
  ]);
  engine.players[0].holeCards = [c("Q", "d"), c("T", "d")];
  engine.players[1].holeCards = [c("2", "h"), c("A", "s")];
  engine.communityCards = [
    c("5", "h"),
    c("J", "s"),
    c("2", "s"),
    c("9", "h"),
    c("K", "s"),
  ];
  engine.pot = 40;
  engine.players[0].totalBet = 20;
  engine.players[1].totalBet = 20;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any).showdown();
  assert.equal(engine.winners?.[0]?.playerId, "a");
  assert.equal(engine.winners?.[0]?.handName, "顺子");
}

console.log("engine tests passed");
