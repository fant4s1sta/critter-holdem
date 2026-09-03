import type { Card, Rank, Suit } from "./types";
import { evaluateBestHand } from "./hand-eval";

const SUITS: Suit[] = ["s", "h", "d", "c"];
const RANKS: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
];

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleInPlace(cards: Card[], rng: () => number): void {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
}

export interface EquityInput {
  holeCards: Card[];
  communityCards: Card[];
  /** Active opponents still in the hand (not folded). */
  opponentCount: number;
  /** Monte Carlo iterations. Default 800. */
  iterations?: number;
  rng?: () => number;
}

/**
 * Estimate hero equity (win + tie share) as a 0–100 percentage
 * against random opponent hands and random remaining board cards.
 */
export function estimateWinRate(input: EquityInput): number {
  const {
    holeCards,
    communityCards,
    opponentCount,
    iterations = 800,
    rng = Math.random,
  } = input;

  if (holeCards.length !== 2) return 0;
  if (opponentCount <= 0) return 100;
  if (communityCards.length > 5) return 0;

  const known = new Set(
    [...holeCards, ...communityCards].map((c) => cardKey(c)),
  );
  const remaining = fullDeck().filter((c) => !known.has(cardKey(c)));
  const needBoard = 5 - communityCards.length;
  const needOppCards = opponentCount * 2;

  if (remaining.length < needBoard + needOppCards) return 0;

  let equity = 0;
  for (let i = 0; i < iterations; i += 1) {
    const pool = remaining.slice();
    shuffleInPlace(pool, rng);

    let cursor = 0;
    const boardExtra = pool.slice(cursor, cursor + needBoard);
    cursor += needBoard;
    const board = [...communityCards, ...boardExtra];

    const hero = evaluateBestHand([...holeCards, ...board]);
    const scores = [hero.score];
    for (let o = 0; o < opponentCount; o += 1) {
      const oppHole = pool.slice(cursor, cursor + 2);
      cursor += 2;
      scores.push(evaluateBestHand([...oppHole, ...board]).score);
    }

    const best = Math.max(...scores);
    const winners = scores.filter((s) => s === best).length;
    if (scores[0] === best) equity += 1 / winners;
  }

  return Math.round((equity / iterations) * 100);
}
