import assert from "node:assert/strict";
import { TexasHoldemEngine } from "../texas-holdem/engine";
import {
  applyCowRuminate,
  createHandSkillState,
  useActiveSkill,
} from "./skill-runtime";

const engine = new TexasHoldemEngine({ turnMs: 60_000 });
engine.startHand([
  { id: "cat", name: "小猫", seat: 0, chips: 1000, away: false },
  { id: "dog", name: "小狗", seat: 1, chips: 1000, away: false },
]);

assert.equal(engine.communityCards.length, 0);
const upcoming = engine.peekDeckTop(3);
assert.equal(upcoming.length, 3);

const hand = createHandSkillState();
useActiveSkill({
  player: { id: "cat", name: "小猫", avatarId: "cat", chips: 1000 },
  players: [
    { id: "cat", name: "小猫", avatarId: "cat", chips: 1000 },
    { id: "dog", name: "小狗", avatarId: "dog", chips: 1000 },
  ],
  engine,
  hand,
  canAct: true,
  payload: { communityIndex: 1 },
});

assert.deepEqual(hand.privateScout.get("cat"), [upcoming[1]]);
assert.equal(hand.privateScout.get("cat")?.length, 1);
assert.equal(hand.privateScoutSlot.get("cat"), 1);

assert.throws(() => {
  const again = createHandSkillState();
  useActiveSkill({
    player: { id: "cat", name: "小猫", avatarId: "cat", chips: 1000 },
    players: [
      { id: "cat", name: "小猫", avatarId: "cat", chips: 1000 },
      { id: "dog", name: "小狗", avatarId: "dog", chips: 1000 },
    ],
    engine,
    hand: again,
    canAct: true,
    payload: { communityIndex: 3 },
  });
}, /请选择要查看的一张牌/);

{
  const stealEngine = new TexasHoldemEngine({ turnMs: 60_000 });
  stealEngine.startHand([
    { id: "mouse", name: "老鼠", seat: 0, chips: 1000, away: false },
    { id: "dog", name: "小狗", seat: 1, chips: 1000, away: false },
  ]);
  const stealHand = createHandSkillState();
  assert.throws(() => {
    useActiveSkill({
      player: { id: "mouse", name: "老鼠", avatarId: "mouse", chips: 1000 },
      players: [
        { id: "mouse", name: "老鼠", avatarId: "mouse", chips: 1000 },
        { id: "dog", name: "小狗", avatarId: "dog", chips: 1000 },
      ],
      engine: stealEngine,
      hand: stealHand,
      canAct: true,
      payload: { targetPlayerId: "mouse" },
    });
  }, /不能选择自己/);
}

{
  // Ox ruminate: 10% of chips invested since last street, not of stack.
  const oxEngine = new TexasHoldemEngine({ turnMs: 60_000 });
  oxEngine.startHand([
    { id: "ox", name: "大牛", seat: 0, chips: 1000, away: false },
    { id: "dog", name: "小狗", seat: 1, chips: 1000, away: false },
  ]);
  const ox = oxEngine.getPlayer("ox")!;
  const investedPreflop = ox.totalBet;
  assert.ok(investedPreflop > 0);
  const chipsBefore = ox.chips;
  const oxHand = createHandSkillState();
  const oxRef = {
    id: "ox",
    name: "大牛",
    avatarId: "ox" as const,
    chips: ox.chips,
  };
  applyCowRuminate(oxEngine, [oxRef], oxHand);
  const expected = Math.floor(investedPreflop * 0.1);
  assert.equal(oxEngine.getPlayer("ox")!.chips, chipsBefore + expected);
  assert.equal(oxHand.oxInvestedBaseline.get("ox"), investedPreflop);

  // Second street with no new investment → no bonus.
  const chipsAfter = oxEngine.getPlayer("ox")!.chips;
  applyCowRuminate(oxEngine, [oxRef], oxHand);
  assert.equal(oxEngine.getPlayer("ox")!.chips, chipsAfter);
}

console.log("skill-runtime scout tests passed");
