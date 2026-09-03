import type { Card, Rank } from "./types";

const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export interface HandRank {
  /** Higher is better. Category in high bits, kickers packed after. */
  score: number;
  name: string;
  cards: Card[];
}

function combinations(cards: Card[], k: number): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  const idxs = Array.from({ length: k }, (_, i) => i);

  const push = () => result.push(idxs.map((i) => cards[i]));

  while (true) {
    push();
    let i = k - 1;
    while (i >= 0 && idxs[i] === n - k + i) i -= 1;
    if (i < 0) break;
    idxs[i] += 1;
    for (let j = i + 1; j < k; j += 1) idxs[j] = idxs[j - 1] + 1;
  }
  return result;
}

function isStraight(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  if (uniq.includes(14)) uniq.push(1); // wheel
  let run = 1;
  for (let i = 0; i < uniq.length - 1; i += 1) {
    if (uniq[i] - 1 === uniq[i + 1]) {
      run += 1;
      if (run === 5) return uniq[i - 3] === 14 && uniq[i + 1] === 1 ? 5 : uniq[i - 3];
    } else {
      run = 1;
    }
  }
  return null;
}

function evaluateFive(cards: Card[]): HandRank {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);
  const straightHigh = isStraight(values);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const pack = (category: number, kickers: number[]) => {
    let score = category * 1e10;
    for (let i = 0; i < 5; i += 1) {
      score += (kickers[i] ?? 0) * 100 ** (4 - i);
    }
    return score;
  };

  if (flush && straightHigh) {
    return {
      score: pack(8, [straightHigh]),
      name: straightHigh === 14 ? "皇家同花顺" : "同花顺",
      cards,
    };
  }
  if (groups[0][1] === 4) {
    return {
      score: pack(7, [groups[0][0], groups[1][0]]),
      name: "四条",
      cards,
    };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      score: pack(6, [groups[0][0], groups[1][0]]),
      name: "葫芦",
      cards,
    };
  }
  if (flush) {
    return { score: pack(5, values), name: "同花", cards };
  }
  if (straightHigh) {
    return { score: pack(4, [straightHigh]), name: "顺子", cards };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      score: pack(3, [groups[0][0], ...kickers]),
      name: "三条",
      cards,
    };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    return {
      score: pack(2, [highPair, lowPair, groups[2][0]]),
      name: "两对",
      cards,
    };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return {
      score: pack(1, [groups[0][0], ...kickers]),
      name: "一对",
      cards,
    };
  }
  return { score: pack(0, values), name: "高牌", cards };
}

/** Best 5-card hand from 5–7 cards */
export function evaluateBestHand(cards: Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error("至少需要 5 张牌");
  }
  if (cards.length === 5) return evaluateFive(cards);
  let best: HandRank | null = null;
  for (const five of combinations(cards, 5)) {
    const rank = evaluateFive(five);
    if (!best || rank.score > best.score) best = rank;
  }
  return best!;
}

export function compareHands(a: HandRank, b: HandRank): number {
  return a.score - b.score;
}
