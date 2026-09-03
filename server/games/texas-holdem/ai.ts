import type { PlayerActionType } from "../../../src/lib/types";
import { evaluateBestHand } from "./hand-eval";
import type { SeatPlayer, TexasHoldemEngine } from "./engine";

const RANK_ORDER = "23456789TJQKA";

function holeStrength(player: SeatPlayer): number {
  const [a, b] = player.holeCards;
  const va = RANK_ORDER.indexOf(a.rank);
  const vb = RANK_ORDER.indexOf(b.rank);
  const high = Math.max(va, vb);
  const low = Math.min(va, vb);
  const paired = a.rank === b.rank;
  const suited = a.suit === b.suit;
  let score = high * 2 + low * 0.5;
  if (paired) score += 8;
  if (suited) score += 2;
  if (high - low <= 2) score += 1.5;
  return score; // roughly 0–40
}

export function chooseAiAction(
  engine: TexasHoldemEngine,
  playerId: string,
): { type: PlayerActionType; amount?: number } {
  const player = engine.getPlayer(playerId);
  if (!player) return { type: "fold" };

  const toCall = engine.currentBet - player.betThisStreet;
  const pot = engine.pot;
  const stack = player.chips;

  let strength = holeStrength(player);
  if (engine.communityCards.length >= 3) {
    try {
      const hand = evaluateBestHand([
        ...player.holeCards,
        ...engine.communityCards,
      ]);
      // Map category roughly onto 0–40 scale
      const category = Math.floor(hand.score / 1e10);
      strength = Math.max(strength, 10 + category * 5);
    } catch {
      // ignore
    }
  }

  // Pot odds heuristic
  const potOdds = toCall / (pot + toCall + 1);

  if (toCall === 0) {
    if (strength >= 28 && stack > engine.config.bigBlind) {
      const bet = Math.min(
        stack,
        Math.max(engine.config.bigBlind, Math.floor(pot * 0.55)),
      );
      return { type: "bet", amount: player.betThisStreet + bet };
    }
    return { type: "check" };
  }

  if (strength < 12 && potOdds > 0.35) {
    return { type: "fold" };
  }

  if (strength >= 30 && stack > toCall) {
    const raiseTo = Math.min(
      player.betThisStreet + stack,
      engine.currentBet + Math.max(engine.minRaise, Math.floor(pot * 0.7)),
    );
    if (raiseTo > engine.currentBet) {
      return { type: "raise", amount: raiseTo };
    }
  }

  if (toCall >= stack) {
    return strength >= 16 ? { type: "all-in" } : { type: "fold" };
  }

  if (strength >= 14 || potOdds <= 0.28) {
    return { type: "call" };
  }

  return { type: "fold" };
}
