import type {
  Card,
  PlayerActionType,
  Street,
  TexasHoldemPublicState,
} from "../../../src/lib/types";
import { randomInt } from "crypto";
import { createShuffledDeck } from "./deck";
import { evaluateBestHand } from "./hand-eval";

export interface SeatPlayer {
  id: string;
  name: string;
  seat: number;
  chips: number;
  away: boolean;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  betThisStreet: number;
  totalBet: number;
}

export interface EngineConfig {
  smallBlind: number;
  bigBlind: number;
  turnMs: number;
}

export interface TexasHoldemEngineSnapshot {
  config: EngineConfig;
  handNumber: number;
  street: Street;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  actingSeat: number | null;
  turnEndsAt: number | null;
  players: SeatPlayer[];
  deck: Card[];
  lastAction?: TexasHoldemPublicState["lastAction"];
  winners?: TexasHoldemPublicState["winners"];
  handSummary?: TexasHoldemPublicState["handSummary"];
  handOver: boolean;
  playersToAct: number;
}

const DEFAULT_CONFIG: EngineConfig = {
  smallBlind: 10,
  bigBlind: 20,
  turnMs: 20_000,
};

function nextOccupiedSeat(
  seats: SeatPlayer[],
  fromSeat: number,
  predicate: (p: SeatPlayer) => boolean = () => true,
): number | null {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  if (ordered.length === 0) return null;
  const startIdx = ordered.findIndex((p) => p.seat > fromSeat);
  const rot =
    startIdx === -1
      ? ordered
      : [...ordered.slice(startIdx), ...ordered.slice(0, startIdx)];
  for (const p of rot) {
    if (predicate(p)) return p.seat;
  }
  return null;
}

function prevOccupiedSeat(
  seats: SeatPlayer[],
  fromSeat: number,
  predicate: (p: SeatPlayer) => boolean = () => true,
): number | null {
  const ordered = [...seats]
    .filter(predicate)
    .sort((a, b) => a.seat - b.seat);
  if (ordered.length === 0) return null;
  const idx = ordered.findIndex((p) => p.seat === fromSeat);
  if (idx < 0) return ordered[ordered.length - 1].seat;
  const prev = ordered[(idx - 1 + ordered.length) % ordered.length];
  return prev.seat;
}

/** First active seat at `startSeat`, then clockwise around the table. */
function firstActiveFromSeat(
  seats: SeatPlayer[],
  startSeat: number,
  predicate: (p: SeatPlayer) => boolean = () => true,
): number | null {
  const ordered = [...seats].sort((a, b) => a.seat - b.seat);
  const idx = ordered.findIndex((p) => p.seat === startSeat);
  const rot =
    idx < 0 ? ordered : [...ordered.slice(idx), ...ordered.slice(0, idx)];
  for (const p of rot) {
    if (predicate(p)) return p.seat;
  }
  return null;
}

function playerAt(seats: SeatPlayer[], seat: number): SeatPlayer | undefined {
  return seats.find((p) => p.seat === seat);
}

function canAct(p: SeatPlayer): boolean {
  return !p.folded && !p.allIn && p.chips > 0;
}

export class TexasHoldemEngine {
  readonly config: EngineConfig;
  handNumber = 0;
  street: Street = "preflop";
  communityCards: Card[] = [];
  pot = 0;
  currentBet = 0;
  minRaise = 0;
  dealerSeat = 0;
  smallBlindSeat = 0;
  bigBlindSeat = 0;
  actingSeat: number | null = null;
  turnEndsAt: number | null = null;
  players: SeatPlayer[] = [];
  deck: Card[] = [];
  lastAction?: TexasHoldemPublicState["lastAction"];
  winners?: TexasHoldemPublicState["winners"];
  handSummary?: TexasHoldemPublicState["handSummary"];
  handOver = false;
  private playersToAct = 0;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  startHand(
    seated: {
      id: string;
      name: string;
      seat: number;
      chips: number;
      away: boolean;
    }[],
  ): void {
    const eligible = seated.filter((p) => p.chips > 0);
    if (eligible.length < 2) {
      throw new Error("至少需要 2 名有筹码的玩家");
    }

    this.handNumber += 1;
    this.handOver = false;
    this.winners = undefined;
    this.handSummary = undefined;
    this.communityCards = [];
    this.pot = 0;
    this.street = "preflop";
    this.deck = createShuffledDeck();

    this.players = eligible.map((p) => ({
      ...p,
      holeCards: [],
      folded: false,
      allIn: false,
      betThisStreet: 0,
      totalBet: 0,
    }));

    const seats = this.players.map((p) => p.seat).sort((a, b) => a - b);
    const seatZero = this.players.some((p) => p.seat === 0);

    if (this.handNumber === 1) {
      // New game: small blind starts at seat 0 when occupied.
      this.smallBlindSeat = seatZero ? 0 : seats[0];
    } else {
      this.smallBlindSeat =
        nextOccupiedSeat(this.players, this.smallBlindSeat) ?? seats[0];
    }

    if (this.players.length === 2) {
      this.dealerSeat = this.smallBlindSeat;
      this.bigBlindSeat =
        nextOccupiedSeat(this.players, this.smallBlindSeat) ?? this.smallBlindSeat;
    } else {
      this.bigBlindSeat =
        nextOccupiedSeat(this.players, this.smallBlindSeat) ??
        this.smallBlindSeat;
      this.dealerSeat =
        prevOccupiedSeat(this.players, this.smallBlindSeat) ?? seats[0];
    }

    this.postBlind(this.smallBlindSeat, this.config.smallBlind);
    this.postBlind(this.bigBlindSeat, this.config.bigBlind);

    for (const p of this.players) {
      p.holeCards = [this.deck.pop()!, this.deck.pop()!];
    }

    this.currentBet = Math.max(
      ...this.players.map((p) => p.betThisStreet),
      this.config.bigBlind,
    );
    this.minRaise = this.config.bigBlind;

    // Preflop: first to act is left of BB. Everyone including BB still to act.
    this.playersToAct = this.players.filter(canAct).length;
    this.actingSeat =
      nextOccupiedSeat(this.players, this.bigBlindSeat, canAct) ?? null;
    this.refreshTurnClock();
    this.lastAction = {
      playerId: "system",
      playerName: "系统",
      type: "deal",
    };
  }

  private postBlind(seat: number, amount: number) {
    const p = playerAt(this.players, seat);
    if (!p) return;
    const paid = Math.min(amount, p.chips);
    p.chips -= paid;
    p.betThisStreet += paid;
    p.totalBet += paid;
    this.pot += paid;
    if (p.chips === 0) p.allIn = true;
    this.lastAction = {
      playerId: p.id,
      playerName: p.name,
      type: "blind",
      amount: paid,
    };
  }

  refreshTurnClock(now = Date.now()) {
    this.turnEndsAt = this.actingSeat == null ? null : now + this.config.turnMs;
  }

  applyAction(
    playerId: string,
    type: PlayerActionType,
    amount?: number,
    opts: { ai?: boolean } = {},
  ): void {
    if (this.handOver || this.actingSeat == null) {
      throw new Error("当前不能操作");
    }
    const actor = playerAt(this.players, this.actingSeat);
    if (!actor || actor.id !== playerId) {
      throw new Error("还没轮到你");
    }
    if (!canAct(actor)) {
      throw new Error("无法操作");
    }

    const toCall = this.currentBet - actor.betThisStreet;
    let raised = false;

    switch (type) {
      case "fold": {
        actor.folded = true;
        this.lastAction = {
          playerId: actor.id,
          playerName: actor.name,
          type: "fold",
          ai: opts.ai,
        };
        break;
      }
      case "check": {
        if (toCall > 0) throw new Error("有人下注，不能过牌");
        this.lastAction = {
          playerId: actor.id,
          playerName: actor.name,
          type: "check",
          ai: opts.ai,
        };
        break;
      }
      case "call": {
        if (toCall <= 0) throw new Error("没有需要跟的注");
        const paid = Math.min(toCall, actor.chips);
        actor.chips -= paid;
        actor.betThisStreet += paid;
        actor.totalBet += paid;
        this.pot += paid;
        if (actor.chips === 0) actor.allIn = true;
        this.lastAction = {
          playerId: actor.id,
          playerName: actor.name,
          type: actor.allIn ? "all-in" : "call",
          amount: paid,
          ai: opts.ai,
        };
        break;
      }
      case "bet":
      case "raise":
      case "all-in": {
        let target = amount ?? 0;
        if (type === "all-in") {
          target = actor.betThisStreet + actor.chips;
        }
        if (target <= actor.betThisStreet) {
          throw new Error("下注金额无效");
        }
        const contribute = target - actor.betThisStreet;
        if (contribute > actor.chips) {
          throw new Error("筹码不足");
        }

        const raiseBy = target - this.currentBet;
        const isAllIn = contribute === actor.chips;

        if (!isAllIn) {
          if (this.currentBet === 0) {
            if (contribute < this.config.bigBlind) {
              throw new Error("下注低于最低额");
            }
          } else if (raiseBy < this.minRaise && target > this.currentBet) {
            throw new Error("加注低于最低额");
          }
        }

        actor.chips -= contribute;
        actor.betThisStreet += contribute;
        actor.totalBet += contribute;
        this.pot += contribute;
        if (actor.chips === 0) actor.allIn = true;

        if (target > this.currentBet) {
          if (raiseBy > 0) {
            this.minRaise = Math.max(this.minRaise, raiseBy);
          }
          this.currentBet = target;
          raised = true;
        }

        const actionType: PlayerActionType = actor.allIn
          ? "all-in"
          : this.currentBet === 0 || toCall === 0
            ? "bet"
            : "raise";

        this.lastAction = {
          playerId: actor.id,
          playerName: actor.name,
          type: raised || actor.allIn ? actionType : "call",
          amount: contribute,
          ai: opts.ai,
        };
        break;
      }
      default:
        throw new Error("未知操作");
    }

    if (raised) {
      this.playersToAct = this.players.filter(
        (p) => canAct(p) && p.id !== actor.id,
      ).length;
    } else {
      this.playersToAct = Math.max(0, this.playersToAct - 1);
    }

    this.advanceAfterAction();
  }

  private livingPlayers(): SeatPlayer[] {
    return this.players.filter((p) => !p.folded);
  }

  private advanceAfterAction() {
    const living = this.livingPlayers();
    if (living.length === 1) {
      this.awardPot(living);
      return;
    }

    const actionable = living.filter(canAct);
    if (actionable.length === 0) {
      this.runOutBoardAndShowdown();
      return;
    }

    if (this.playersToAct === 0) {
      this.nextStreet();
      return;
    }

    const next =
      nextOccupiedSeat(this.players, this.actingSeat!, (p) => canAct(p)) ??
      null;
    this.actingSeat = next;
    this.refreshTurnClock();
  }

  private nextStreet() {
    for (const p of this.players) {
      p.betThisStreet = 0;
    }
    this.currentBet = 0;
    this.minRaise = this.config.bigBlind;

    if (this.street === "preflop") {
      this.street = "flop";
      this.communityCards.push(
        this.deck.pop()!,
        this.deck.pop()!,
        this.deck.pop()!,
      );
    } else if (this.street === "flop") {
      this.street = "turn";
      this.communityCards.push(this.deck.pop()!);
    } else if (this.street === "turn") {
      this.street = "river";
      this.communityCards.push(this.deck.pop()!);
    } else if (this.street === "river") {
      this.showdown();
      return;
    }

    const living = this.livingPlayers();
    const actionable = living.filter(canAct);
    if (actionable.length <= 1) {
      this.runOutBoardAndShowdown();
      return;
    }

    this.playersToAct = actionable.length;
    this.actingSeat =
      firstActiveFromSeat(this.players, this.smallBlindSeat, canAct) ?? null;
    this.refreshTurnClock();
  }

  private runOutBoardAndShowdown() {
    while (this.communityCards.length < 5) {
      this.communityCards.push(this.deck.pop()!);
    }
    this.showdown();
  }

  private showdown() {
    this.street = "showdown";
    this.actingSeat = null;
    this.turnEndsAt = null;

    const contenders = this.livingPlayers();
    const evaluated = contenders.map((p) => ({
      player: p,
      hand: evaluateBestHand([...p.holeCards, ...this.communityCards]),
    }));

    const levels = [...new Set(this.players.map((p) => p.totalBet))]
      .filter((n) => n > 0)
      .sort((a, b) => a - b);

    let prev = 0;
    const winners: NonNullable<TexasHoldemPublicState["winners"]> = [];
    let remainingPot = this.pot;

    for (const level of levels) {
      const contributors = this.players.filter((p) => p.totalBet >= level);
      const eligible = evaluated.filter((e) => e.player.totalBet >= level);
      if (eligible.length === 0) {
        prev = level;
        continue;
      }
      const potSlice = (level - prev) * contributors.length;
      prev = level;
      const slice = Math.min(potSlice, remainingPot);
      if (slice <= 0) continue;
      remainingPot -= slice;

      let best = eligible[0].hand.score;
      for (const e of eligible) best = Math.max(best, e.hand.score);
      const potWinners = eligible.filter((e) => e.hand.score === best);
      const share = Math.floor(slice / potWinners.length);
      let leftover = slice - share * potWinners.length;
      for (const w of potWinners) {
        const extra = leftover > 0 ? 1 : 0;
        leftover -= extra;
        const amount = share + extra;
        w.player.chips += amount;
        winners.push({
          playerId: w.player.id,
          amount,
          handName: w.hand.name,
        });
      }
    }

    if (remainingPot > 0 && evaluated.length > 0) {
      let best = evaluated[0].hand.score;
      for (const e of evaluated) best = Math.max(best, e.hand.score);
      const potWinners = evaluated.filter((e) => e.hand.score === best);
      const share = Math.floor(remainingPot / potWinners.length);
      let leftover = remainingPot - share * potWinners.length;
      for (const w of potWinners) {
        const extra = leftover > 0 ? 1 : 0;
        leftover -= extra;
        const amount = share + extra;
        w.player.chips += amount;
        winners.push({
          playerId: w.player.id,
          amount,
          handName: w.hand.name,
        });
      }
    }

    const merged = new Map<
      string,
      { playerId: string; amount: number; handName?: string }
    >();
    for (const w of winners) {
      const prevW = merged.get(w.playerId);
      if (prevW) prevW.amount += w.amount;
      else merged.set(w.playerId, { ...w });
    }
    this.winners = [...merged.values()];
    this.handSummary = this.buildHandSummary(merged);
    this.pot = 0;
    this.handOver = true;
  }

  private awardPot(winners: SeatPlayer[]) {
    this.actingSeat = null;
    this.turnEndsAt = null;
    this.street = "showdown";
    const share = Math.floor(this.pot / winners.length);
    let leftover = this.pot - share * winners.length;
    this.winners = winners.map((w) => {
      const extra = leftover > 0 ? 1 : 0;
      leftover -= extra;
      const amount = share + extra;
      w.chips += amount;
      return { playerId: w.id, amount };
    });
    const merged = new Map(
      this.winners.map((w) => [w.playerId, { ...w }]),
    );
    this.handSummary = this.buildHandSummary(merged);
    this.pot = 0;
    this.handOver = true;
  }

  private buildHandSummary(
    winById: Map<string, { playerId: string; amount: number; handName?: string }>,
  ): NonNullable<TexasHoldemPublicState["handSummary"]> {
    return this.players
      .filter((p) => p.holeCards.length > 0)
      .map((p) => {
        const canEval =
          p.holeCards.length === 2 && this.communityCards.length >= 3;
        const hand = canEval
          ? evaluateBestHand([...p.holeCards, ...this.communityCards])
          : undefined;
        return {
          playerId: p.id,
          holeCards: [...p.holeCards],
          handName: hand?.name,
          folded: p.folded,
          winAmount: winById.get(p.id)?.amount ?? 0,
        };
      });
  }

  syncAwayFlags(awayById: Map<string, boolean>) {
    for (const p of this.players) {
      p.away = awayById.get(p.id) ?? p.away;
    }
  }

  syncChipsOut(chipById: Map<string, number>) {
    for (const p of this.players) {
      chipById.set(p.id, p.chips);
    }
  }

  toPublic(): TexasHoldemPublicState {
    return {
      gameType: "texas-holdem",
      handNumber: this.handNumber,
      street: this.street,
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerSeat: this.dealerSeat,
      smallBlindSeat: this.smallBlindSeat,
      bigBlindSeat: this.bigBlindSeat,
      actingSeat: this.actingSeat,
      actingPlayerId:
        this.actingSeat == null
          ? null
          : (playerAt(this.players, this.actingSeat)?.id ?? null),
      turnEndsAt: this.turnEndsAt,
      smallBlind: this.config.smallBlind,
      bigBlind: this.config.bigBlind,
      winners: this.winners,
      handSummary: this.handSummary,
      lastAction: this.lastAction,
    };
  }

  holeCardsFor(playerId: string): Card[] | null {
    return this.players.find((p) => p.id === playerId)?.holeCards ?? null;
  }

  getPlayer(playerId: string): SeatPlayer | undefined {
    return this.players.find((p) => p.id === playerId);
  }

  /**
   * Skill-mode dragon tail-sweep: discard hole cards and draw two new ones.
   * Old cards leave play; does not end the player's turn.
   */
  redrawHoleCards(playerId: string): Card[] {
    if (this.handOver) throw new Error("本手已结束");
    const p = this.getPlayer(playerId);
    if (!p || p.folded) throw new Error("你已不在牌局中");
    if (p.holeCards.length < 2) throw new Error("还没有手牌");
    if (this.deck.length < 2) throw new Error("牌堆不足");

    p.holeCards = [this.deck.pop()!, this.deck.pop()!];
    return [...p.holeCards];
  }

  /**
   * Skill-mode tiger roar: take one random hole card from each non-folded
   * player, shuffle the pool, and deal one card back to each.
   */
  roarRedistributeHoleCards(actorId: string): void {
    if (this.handOver) throw new Error("本手已结束");
    const actor = this.getPlayer(actorId);
    if (!actor || actor.folded) throw new Error("你已不在牌局中");

    const living = this.players.filter(
      (p) => !p.folded && p.holeCards.length > 0,
    );
    if (living.length < 2) throw new Error("未弃牌玩家不足，无法发威");

    const pool: Card[] = [];
    for (const p of living) {
      const idx = randomInt(0, p.holeCards.length);
      const [taken] = p.holeCards.splice(idx, 1);
      pool.push(taken);
    }

    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    for (let i = 0; i < living.length; i += 1) {
      living[i].holeCards.push(pool[i]!);
    }
  }

  /** Skill-mode: force a living player to fold. */
  forceFold(playerId: string): void {
    const p = this.getPlayer(playerId);
    if (!p || p.folded) throw new Error("无法冰封该玩家");
    p.folded = true;
    this.lastAction = {
      playerId: p.id,
      playerName: p.name,
      type: "fold",
    };
    if (this.actingSeat != null && playerAt(this.players, this.actingSeat)?.id === playerId) {
      this.playersToAct = Math.max(0, this.playersToAct - 1);
      this.advanceAfterAction();
      return;
    }
    const living = this.livingPlayers();
    if (living.length === 1) {
      this.awardPot(living);
    }
  }

  /**
   * Skill-mode fox fraud: choose a raiseTo amount that the table treats as real.
   * Deduct the full contribution from fox chips and raise currentBet so others
   * must call the fake amount, but only the true call enters the pot.
   * Returns escrow (fake portion) to restore at hand end.
   */
  applyFraud(playerId: string, raiseTo: number): number {
    if (this.handOver || this.actingSeat == null) {
      throw new Error("当前不能操作");
    }
    const actor = playerAt(this.players, this.actingSeat);
    if (!actor || actor.id !== playerId) throw new Error("还没轮到你");
    if (!canAct(actor)) throw new Error("无法操作");

    const toCall = this.currentBet - actor.betThisStreet;
    if (toCall <= 0) throw new Error("没有需要跟的注，无法欺诈");

    const minRaiseTo = this.currentBet + this.minRaise;
    const maxRaiseTo = actor.betThisStreet + actor.chips;
    if (raiseTo < minRaiseTo) throw new Error("虚假加注额太低");
    if (raiseTo > maxRaiseTo) throw new Error("筹码不足");

    const fakeContribute = raiseTo - actor.betThisStreet;
    if (fakeContribute > actor.chips) throw new Error("筹码不足");
    if (fakeContribute < toCall) throw new Error("虚假加注额无效");

    const callPaid = toCall;
    const escrow = fakeContribute - callPaid;
    const raiseBy = raiseTo - this.currentBet;

    actor.chips -= fakeContribute;
    // Street matching uses the fake raise level so others must respond to it.
    actor.betThisStreet += fakeContribute;
    // Only real call chips count toward pot / side-pot investment.
    actor.totalBet += callPaid;
    this.pot += callPaid;
    if (actor.chips === 0) actor.allIn = true;

    if (raiseBy > 0) {
      this.minRaise = Math.max(this.minRaise, raiseBy);
    }
    this.currentBet = raiseTo;

    this.lastAction = {
      playerId: actor.id,
      playerName: actor.name,
      type: actor.allIn ? "all-in" : "raise",
      amount: fakeContribute,
    };
    // Same as a real raise: reopen action for everyone else.
    this.playersToAct = this.players.filter(
      (p) => canAct(p) && p.id !== actor.id,
    ).length;
    this.advanceAfterAction();
    return escrow;
  }

  /**
   * Skill-mode koala: end current turn as a special check even if toCall > 0.
   * Does not pay the call; player stays in the hand.
   */
  applySleep(playerId: string): void {
    if (this.handOver || this.actingSeat == null) {
      throw new Error("当前不能操作");
    }
    const actor = playerAt(this.players, this.actingSeat);
    if (!actor || actor.id !== playerId) throw new Error("还没轮到你");
    if (!canAct(actor)) throw new Error("无法操作");

    this.lastAction = {
      playerId: actor.id,
      playerName: actor.name,
      type: "check",
    };
    this.playersToAct = Math.max(0, this.playersToAct - 1);
    this.advanceAfterAction();
  }

  /** Peek next N cards from the deck without removing them. */
  peekDeckTop(count: number): Card[] {
    if (count <= 0) return [];
    const start = Math.max(0, this.deck.length - count);
    return this.deck.slice(start).reverse();
  }

  /** Replace one community card with the next from the deck. */
  replaceCommunityCard(index: number): Card {
    if (index < 0 || index >= this.communityCards.length) {
      throw new Error("无效的公共牌");
    }
    const next = this.deck.pop();
    if (!next) throw new Error("牌堆不足");
    this.communityCards[index] = next;
    return next;
  }

  /** Force player to call current bet (or all-in). */
  forceCall(playerId: string): void {
    const p = this.getPlayer(playerId);
    if (!p || p.folded || p.allIn) return;
    const toCall = this.currentBet - p.betThisStreet;
    if (toCall <= 0) return;
    const paid = Math.min(toCall, p.chips);
    p.chips -= paid;
    p.betThisStreet += paid;
    p.totalBet += paid;
    this.pot += paid;
    if (p.chips === 0) p.allIn = true;
  }

  /** Refund chips to a player from pot (rabbit / hamster). */
  refundFromPot(playerId: string, amount: number): number {
    const p = this.getPlayer(playerId);
    if (!p || amount <= 0) return 0;
    const paid = Math.min(amount, this.pot, p.totalBet);
    this.pot -= paid;
    p.chips += paid;
    p.totalBet = Math.max(0, p.totalBet - paid);
    p.betThisStreet = Math.min(p.betThisStreet, p.totalBet);
    return paid;
  }

  addChipsFromBank(playerId: string, amount: number): void {
    const p = this.getPlayer(playerId);
    if (!p || amount <= 0) return;
    p.chips += Math.floor(amount);
  }

  toSnapshot(): TexasHoldemEngineSnapshot {
    return structuredClone({
      config: this.config,
      handNumber: this.handNumber,
      street: this.street,
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      dealerSeat: this.dealerSeat,
      smallBlindSeat: this.smallBlindSeat,
      bigBlindSeat: this.bigBlindSeat,
      actingSeat: this.actingSeat,
      turnEndsAt: this.turnEndsAt,
      players: this.players,
      deck: this.deck,
      lastAction: this.lastAction,
      winners: this.winners,
      handSummary: this.handSummary,
      handOver: this.handOver,
      playersToAct: this.playersToAct,
    });
  }

  static fromSnapshot(snapshot: TexasHoldemEngineSnapshot): TexasHoldemEngine {
    const engine = new TexasHoldemEngine(snapshot.config);
    Object.assign(engine, structuredClone({
      handNumber: snapshot.handNumber,
      street: snapshot.street,
      communityCards: snapshot.communityCards,
      pot: snapshot.pot,
      currentBet: snapshot.currentBet,
      minRaise: snapshot.minRaise,
      dealerSeat: snapshot.dealerSeat,
      smallBlindSeat: snapshot.smallBlindSeat,
      bigBlindSeat: snapshot.bigBlindSeat,
      actingSeat: snapshot.actingSeat,
      turnEndsAt: snapshot.turnEndsAt,
      players: snapshot.players,
      deck: snapshot.deck,
      lastAction: snapshot.lastAction,
      winners: snapshot.winners,
      handSummary: snapshot.handSummary,
      handOver: snapshot.handOver,
      playersToAct: snapshot.playersToAct,
    }));
    return engine;
  }
}
