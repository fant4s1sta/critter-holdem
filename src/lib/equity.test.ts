import { estimateWinRate } from "./equity";
import type { Card } from "./types";

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// AA vs 1 random opponent preflop should be strongly favored (~85%).
{
  const rate = estimateWinRate({
    holeCards: [c("A", "s"), c("A", "h")],
    communityCards: [],
    opponentCount: 1,
    iterations: 1200,
    rng: (() => {
      let s = 42;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })(),
  });
  assert(rate >= 75 && rate <= 95, `AA preflop equity unexpected: ${rate}`);
}

// Solo (no opponents) → 100%.
{
  const rate = estimateWinRate({
    holeCards: [c("2", "c"), c("7", "d")],
    communityCards: [],
    opponentCount: 0,
  });
  assert(rate === 100, `solo equity should be 100, got ${rate}`);
}

// Nut flush on river vs 1 opponent should nearly always win.
{
  const rate = estimateWinRate({
    holeCards: [c("A", "h"), c("K", "h")],
    communityCards: [c("2", "h"), c("7", "h"), c("9", "h"), c("3", "c"), c("4", "d")],
    opponentCount: 1,
    iterations: 600,
    rng: (() => {
      let s = 7;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })(),
  });
  assert(rate >= 90, `nut flush river equity unexpected: ${rate}`);
}

console.log("equity tests passed");
