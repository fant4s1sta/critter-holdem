import type { AnimalId, Card, SkillPublicState } from "../../../src/lib/types";
import { getAnimalSkill } from "../../../src/lib/skill-catalog";
import type { TexasHoldemEngine } from "../texas-holdem/engine";
import { evaluateBestHand } from "../texas-holdem/hand-eval";

export interface SkillPlayerRef {
  id: string;
  name: string;
  avatarId: AnimalId;
  chips: number;
}

export interface HandSkillState {
  usedActive: Set<string>;
  /** polar-bear: hands remaining before usable again */
  cooldownLeft: Map<string, number>;
  dogArmed: Set<string>;
  hamsterArmed: Set<string>;
  mouseSteal: Map<string, { targetId: string; amount: number }>;
  /** casterId → targetId (one-way); split only if target wins */
  bearHug: Map<string, string>;
  /** casterId → targetId; first of the pair to fold pays 5% chips to the other */
  lionDuel: Map<string, string>;
  /** Duel pairs already settled this hand (casterId keys) */
  lionDuelSettled: Set<string>;
  /** polar-bear freeze: player ids blocked from betting/raising this hand */
  freezeNoRaise: Set<string>;
  /** panda harmony: later actors this street cannot raise */
  pandaHarmony: {
    street: string;
    casterId: string;
    casterSeat: number;
  } | null;
  checkedThisStreet: Set<string>;
  privateScout: Map<string, Card[]>;
  /** community slot index (0–4) for the peeked card */
  privateScoutSlot: Map<string, number>;
  /** Fox fraud: fake raise chips held aside until hand end */
  fraudEscrow: Map<string, number>;
  lastEvent: SkillPublicState["lastSkillEvent"];
  /** chips won this hand before bank bonuses (for bear hug / frog) */
  handWon: Map<string, number>;
}

export function createHandSkillState(): HandSkillState {
  return {
    usedActive: new Set(),
    cooldownLeft: new Map(),
    dogArmed: new Set(),
    hamsterArmed: new Set(),
    mouseSteal: new Map(),
    bearHug: new Map(),
    lionDuel: new Map(),
    lionDuelSettled: new Set(),
    freezeNoRaise: new Set(),
    pandaHarmony: null,
    checkedThisStreet: new Set(),
    privateScout: new Map(),
    privateScoutSlot: new Map(),
    fraudEscrow: new Map(),
    lastEvent: null,
    handWon: new Map(),
  };
}

/** Carry cooldown map into a fresh hand state. */
export function nextHandSkillState(prev: HandSkillState | null): HandSkillState {
  const next = createHandSkillState();
  if (!prev) return next;
  for (const [id, left] of prev.cooldownLeft) {
    const n = Math.max(0, left - 1);
    if (n > 0) next.cooldownLeft.set(id, n);
  }
  return next;
}

export type SkillUsePayload = {
  targetPlayerId?: string;
  communityIndex?: number;
  raiseTo?: number;
};

function broadcast(
  state: HandSkillState,
  player: SkillPlayerRef,
  text: string,
) {
  const skill = getAnimalSkill(player.avatarId);
  state.lastEvent = {
    animalId: player.avatarId,
    skillName: skill.name,
    playerId: player.id,
    playerName: player.name,
    text,
    at: Date.now(),
  };
}

export function buildViewerSkillState(opts: {
  ruleMode: "classic" | "skill";
  player: SkillPlayerRef | null;
  spectator: boolean;
  canAct: boolean;
  engine: TexasHoldemEngine | null;
  hand: HandSkillState | null;
}): SkillPublicState | null {
  if (opts.ruleMode !== "skill" || !opts.player || opts.spectator) return null;
  const skill = getAnimalSkill(opts.player.avatarId);
  const hand = opts.hand ?? createHandSkillState();
  const cooldown = hand.cooldownLeft.get(opts.player.id) ?? 0;
  const used = hand.usedActive.has(opts.player.id);

  let canUseActive = false;
  let disabledReason: string | undefined;

  if (skill.kind === "passive") {
    disabledReason = "被动技能，自动触发";
  } else if (!opts.engine || opts.engine.handOver) {
    disabledReason = "当前不在对局中";
  } else if (!opts.canAct) {
    disabledReason = "仅在你的行动回合可发动";
  } else if (used) {
    disabledReason = "本手已发动过技能";
  } else if (cooldown > 0) {
    disabledReason = `冷却中，还需 ${cooldown} 手`;
  } else {
    canUseActive = true;
    // Window-specific soft checks (hard checks on use)
    if (skill.skillId === "guard-food" && opts.engine.communityCards.length > 0) {
      canUseActive = false;
      disabledReason = "护食仅可在翻前发动";
    }
    if (skill.skillId === "scout" && opts.engine.communityCards.length >= 5) {
      canUseActive = false;
      disabledReason = "公共牌已开齐";
    }
    if (skill.skillId === "root" && opts.engine.communityCards.length === 0) {
      canUseActive = false;
      disabledReason = "场上还没有公共牌";
    }
    if (skill.skillId === "roar") {
      const living = opts.engine.players.filter(
        (p) => !p.folded && p.holeCards.length > 0,
      ).length;
      if (living < 2) {
        canUseActive = false;
        disabledReason = "未弃牌玩家不足，无法发威";
      }
    }
    if (skill.skillId === "steal") {
      const selfId = opts.player.id;
      const living = opts.engine.players.filter(
        (p) => !p.folded && p.id !== selfId && p.chips > 0,
      ).length;
      if (living < 1) {
        canUseActive = false;
        disabledReason = "没有可偷吃的对手";
      }
    }
    if (skill.skillId === "freeze") {
      const selfId = opts.player.id;
      const living = opts.engine.players.filter(
        (p) => !p.folded && p.id !== selfId,
      ).length;
      if (living < 1) {
        canUseActive = false;
        disabledReason = "没有可砸晕的对手";
      }
    }
    if (skill.skillId === "fraud") {
      const seat = opts.engine.getPlayer(opts.player.id);
      const toCall = seat
        ? opts.engine.currentBet - seat.betThisStreet
        : 0;
      if (toCall <= 0) {
        canUseActive = false;
        disabledReason = "需要面对下注才能欺诈";
      }
    }
  }

  return {
    canUseActive,
    usedThisHand: used,
    cooldownHandsLeft: cooldown,
    disabledReason,
    scoutCards: (() => {
      const cards = hand.privateScout.get(opts.player.id);
      return cards?.[0] ? [cards[0]] : null;
    })(),
    scoutSlot: hand.privateScoutSlot.get(opts.player.id) ?? null,
    lastSkillEvent: hand.lastEvent,
  };
}

export function assertMayUseActive(
  player: SkillPlayerRef,
  engine: TexasHoldemEngine,
  hand: HandSkillState,
  canAct: boolean,
): void {
  const skill = getAnimalSkill(player.avatarId);
  if (skill.kind !== "active") throw new Error("该技能为被动技能");
  if (!canAct) throw new Error("仅在你的行动回合可发动");
  if (hand.usedActive.has(player.id)) throw new Error("本手已发动过技能");
  const cd = hand.cooldownLeft.get(player.id) ?? 0;
  if (cd > 0) throw new Error(`冷却中，还需 ${cd} 手`);
  if (engine.handOver) throw new Error("本手已结束");
}

export function useActiveSkill(opts: {
  player: SkillPlayerRef;
  players: SkillPlayerRef[];
  engine: TexasHoldemEngine;
  hand: HandSkillState;
  canAct: boolean;
  payload: SkillUsePayload;
}): { endsTurn?: boolean } {
  const { player, engine, hand, payload } = opts;
  assertMayUseActive(player, engine, hand, opts.canAct);
  const skill = getAnimalSkill(player.avatarId);
  const seat = engine.getPlayer(player.id);
  if (!seat || seat.folded) throw new Error("你已不在牌局中");

  switch (skill.skillId) {
    case "guard-food": {
      if (engine.communityCards.length > 0) throw new Error("护食仅可在翻前发动");
      hand.dogArmed.add(player.id);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 发动了护食`);
      return {};
    }
    case "scout": {
      if (engine.communityCards.length >= 5) throw new Error("公共牌已开齐");
      const upcoming = engine.communityCards.length === 0 ? 3 : 1;
      const idx = upcoming === 1 ? 0 : payload.communityIndex;
      if (idx == null || idx < 0 || idx >= upcoming) {
        throw new Error("请选择要查看的一张牌");
      }
      const cards = engine.peekDeckTop(upcoming);
      const chosen = cards[idx];
      if (!chosen) throw new Error("牌堆不足");
      hand.privateScout.set(player.id, [chosen]);
      hand.privateScoutSlot.set(player.id, engine.communityCards.length + idx);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 发动了探路`);
      return {};
    }
    case "steal": {
      const target = opts.players.find((p) => p.id === payload.targetPlayerId);
      if (!target) throw new Error("请选择一名对手");
      if (target.id === player.id) throw new Error("不能选择自己");
      const amount = Math.floor(target.chips * 0.1);
      if (amount <= 0) throw new Error("对方没有可偷的筹码");
      target.chips -= amount;
      player.chips += amount;
      const engTarget = engine.getPlayer(target.id);
      const engSelf = engine.getPlayer(player.id);
      if (engTarget) engTarget.chips = target.chips;
      if (engSelf) engSelf.chips = player.chips;
      hand.mouseSteal.set(player.id, { targetId: target.id, amount });
      hand.usedActive.add(player.id);
      broadcast(
        hand,
        player,
        `${player.name} 偷吃了 ${target.name} 的 ${amount} 筹码`,
      );
      return {};
    }
    case "stash": {
      hand.hamsterArmed.add(player.id);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 发动了存粮`);
      return {};
    }
    case "fraud": {
      const toCall = engine.currentBet - seat.betThisStreet;
      if (toCall <= 0) throw new Error("需要面对下注才能欺诈");
      const raiseTo = payload.raiseTo;
      if (raiseTo == null || raiseTo <= 0) {
        throw new Error("请选择虚假加注金额");
      }
      const escrow = engine.applyFraud(player.id, raiseTo);
      if (escrow > 0) {
        hand.fraudEscrow.set(
          player.id,
          (hand.fraudEscrow.get(player.id) ?? 0) + escrow,
        );
      }
      hand.usedActive.add(player.id);
      broadcast(
        hand,
        player,
        `${player.name} 发动了欺诈（加注至 ${raiseTo}）`,
      );
      return { endsTurn: true };
    }
    case "bear-hug": {
      const targetId = payload.targetPlayerId;
      if (!targetId || targetId === player.id) throw new Error("请选择一名对手");
      if (!engine.getPlayer(targetId)) throw new Error("目标不在牌局中");
      // One-way: caster → target. Split only if target wins this hand.
      hand.bearHug.set(player.id, targetId);
      hand.usedActive.add(player.id);
      const target = opts.players.find((p) => p.id === targetId);
      broadcast(
        hand,
        player,
        `${player.name} 依偎了 ${target?.name ?? "对手"}`,
      );
      return {};
    }
    case "harmony": {
      hand.pandaHarmony = {
        street: engine.street,
        casterId: player.id,
        casterSeat: seat.seat,
      };
      hand.usedActive.add(player.id);
      broadcast(
        hand,
        player,
        `${player.name} 发动了和谐：之后行动的玩家本回合不能加注`,
      );
      return {};
    }
    case "freeze": {
      const targetId = payload.targetPlayerId;
      if (!targetId || targetId === player.id) throw new Error("请选择一名对手");
      const target = engine.getPlayer(targetId);
      if (!target || target.folded) throw new Error("无法砸晕该玩家");
      hand.freezeNoRaise.add(targetId);
      hand.usedActive.add(player.id);
      const tName = opts.players.find((p) => p.id === targetId)?.name ?? "对手";
      broadcast(hand, player, `${player.name} 砸晕了 ${tName}：本手不能加注`);
      return {};
    }
    case "doze": {
      engine.applySleep(player.id);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 装睡过牌`);
      return { endsTurn: true };
    }
    case "roar": {
      engine.roarRedistributeHoleCards(player.id);
      hand.usedActive.add(player.id);
      broadcast(
        hand,
        player,
        `${player.name} 发动了发威：未弃牌者手牌各抽一张重发`,
      );
      return {};
    }
    case "duel": {
      const targetId = payload.targetPlayerId;
      if (!targetId || targetId === player.id) throw new Error("请选择一名对手");
      const target = engine.getPlayer(targetId);
      if (!target || target.folded) throw new Error("目标已弃牌");
      hand.lionDuel.set(player.id, targetId);
      hand.usedActive.add(player.id);
      const tName = opts.players.find((p) => p.id === targetId)?.name ?? "对手";
      broadcast(hand, player, `${player.name} 向 ${tName} 发起单挑`);
      return {};
    }
    case "root": {
      const idx = payload.communityIndex;
      if (idx == null || idx < 0 || idx >= engine.communityCards.length) {
        throw new Error("请选择一张公共牌");
      }
      engine.replaceCommunityCard(idx);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 拱掉了一张公共牌并补上新牌`);
      return {};
    }
    case "tail-sweep": {
      engine.redrawHoleCards(player.id);
      hand.usedActive.add(player.id);
      broadcast(hand, player, `${player.name} 摆尾换牌`);
      return {};
    }
    default:
      throw new Error("未知技能");
  }
}

export function onPlayerChecked(hand: HandSkillState, playerId: string) {
  hand.checkedThisStreet.add(playerId);
}

export function onStreetChanged(hand: HandSkillState) {
  hand.checkedThisStreet = new Set();
  hand.pandaHarmony = null;
}

function actionLooksLikeRaise(
  engine: TexasHoldemEngine,
  actorId: string,
  actionType: string,
): boolean {
  if (actionType === "bet" || actionType === "raise") return true;
  if (actionType !== "all-in") return false;
  const seat = engine.getPlayer(actorId);
  if (!seat) return false;
  return seat.betThisStreet + seat.chips > engine.currentBet;
}

/** True when polar-bear freeze forbids this player from betting/raising. */
export function isRaiseBlockedByFreeze(
  hand: HandSkillState | null,
  engine: TexasHoldemEngine,
  actorId: string,
  actionType: string,
): boolean {
  if (!hand?.freezeNoRaise.has(actorId)) return false;
  return actionLooksLikeRaise(engine, actorId, actionType);
}

/**
 * True when panda harmony forbids this player from betting/raising.
 * Only actors seated after the caster (wrapping by seat order) on the same street.
 */
export function isRaiseBlockedByHarmony(
  hand: HandSkillState | null,
  engine: TexasHoldemEngine,
  actorId: string,
  actionType: string,
): boolean {
  if (!hand?.pandaHarmony) return false;
  if (hand.pandaHarmony.street !== engine.street) return false;
  if (actorId === hand.pandaHarmony.casterId) return false;
  if (!actionLooksLikeRaise(engine, actorId, actionType)) return false;

  const ordered = [...engine.players].sort((a, b) => a.seat - b.seat);
  if (ordered.length === 0) return false;
  const start = ordered.findIndex(
    (p) => p.seat === hand.pandaHarmony!.casterSeat,
  );
  if (start < 0) return false;
  for (let i = 1; i < ordered.length; i += 1) {
    const p = ordered[(start + i) % ordered.length]!;
    if (p.id === hand.pandaHarmony.casterId) break;
    if (p.id === actorId) return true;
  }
  return false;
}

export function isRaiseBlockedBySkills(
  hand: HandSkillState | null,
  engine: TexasHoldemEngine,
  actorId: string,
  actionType: string,
): boolean {
  return (
    isRaiseBlockedByFreeze(hand, engine, actorId, actionType) ||
    isRaiseBlockedByHarmony(hand, engine, actorId, actionType)
  );
}

/** Apply cow ruminate at street boundary for non-folded cows. */
export function applyCowRuminate(
  engine: TexasHoldemEngine,
  players: SkillPlayerRef[],
  hand: HandSkillState,
) {
  for (const p of players) {
    if (p.avatarId !== "ox") continue;
    const seat = engine.getPlayer(p.id);
    if (!seat || seat.folded) continue;
    const bonus = Math.floor(seat.chips * 0.05);
    if (bonus <= 0) continue;
    engine.addChipsFromBank(p.id, bonus);
    p.chips = seat.chips;
    broadcast(hand, p, `${p.name} 反刍获得 ${bonus}`);
  }
}

export function applyRabbitOnFold(
  engine: TexasHoldemEngine,
  player: SkillPlayerRef,
  hand: HandSkillState,
) {
  if (player.avatarId !== "rabbit") return;
  const seat = engine.getPlayer(player.id);
  if (!seat) return;
  const refund = Math.floor(seat.totalBet * 0.5);
  const got = engine.refundFromPot(player.id, refund);
  if (got > 0) {
    player.chips = engine.getPlayer(player.id)!.chips;
    broadcast(hand, player, `${player.name} 开溜，拿回 ${got}`);
  }
}

/**
 * Lion duel: whoever folds first between the bound pair pays 5% of their
 * remaining chips to the other. Settles at most once per binding.
 */
export function applyLionDuelOnFold(
  engine: TexasHoldemEngine,
  players: SkillPlayerRef[],
  hand: HandSkillState,
  folderId: string,
) {
  let casterId: string | null = null;
  let otherId: string | null = null;
  for (const [caster, target] of hand.lionDuel) {
    if (hand.lionDuelSettled.has(caster)) continue;
    if (caster === folderId) {
      casterId = caster;
      otherId = target;
      break;
    }
    if (target === folderId) {
      casterId = caster;
      otherId = caster;
      break;
    }
  }
  if (!casterId || !otherId) return;

  hand.lionDuelSettled.add(casterId);

  const folder = engine.getPlayer(folderId);
  const other = engine.getPlayer(otherId);
  if (!folder || !other) return;

  const amount = Math.floor(folder.chips * 0.05);
  if (amount <= 0) return;

  folder.chips -= amount;
  other.chips += amount;
  const folderRef = players.find((p) => p.id === folderId);
  const otherRef = players.find((p) => p.id === otherId);
  if (folderRef) folderRef.chips = folder.chips;
  if (otherRef) otherRef.chips = other.chips;
  if (folderRef) {
    broadcast(
      hand,
      folderRef,
      `${folderRef.name} 单挑先弃，付给 ${otherRef?.name ?? "对手"} ${amount}`,
    );
  }
}

/**
 * Post-hand skill settlements: mouse repay, dog bonus, hamster, bear, frog.
 * Mutates engine winners / chips. Call while handOver before syncing room chips.
 */
export function settleHandSkills(opts: {
  engine: TexasHoldemEngine;
  players: SkillPlayerRef[];
  hand: HandSkillState;
}) {
  const { engine, players, hand } = opts;
  const won = new Map<string, number>();
  for (const w of engine.winners ?? []) {
    won.set(w.playerId, (won.get(w.playerId) ?? 0) + w.amount);
  }
  hand.handWon = won;

  // Fox fraud: return fake-raise chips held aside (never entered the pot)
  for (const [foxId, escrow] of hand.fraudEscrow) {
    if (escrow <= 0) continue;
    const seat = engine.getPlayer(foxId);
    if (!seat) continue;
    seat.chips += escrow;
    const ref = players.find((p) => p.id === foxId);
    if (ref) {
      ref.chips = seat.chips;
      broadcast(hand, ref, `${ref.name} 欺诈筹码归还 ${escrow}`);
    }
  }
  hand.fraudEscrow.clear();

  // Mouse repay if stolen target is a winner
  for (const [thiefId, steal] of hand.mouseSteal) {
    if ((won.get(steal.targetId) ?? 0) > 0) {
      const repay = steal.amount * 2;
      const thief = engine.getPlayer(thiefId);
      const victim = engine.getPlayer(steal.targetId);
      if (thief && victim) {
        const paid = Math.min(repay, thief.chips);
        thief.chips -= paid;
        victim.chips += paid;
        const tRef = players.find((p) => p.id === thiefId);
        if (tRef) {
          broadcast(
            hand,
            tRef,
            `${tRef.name} 偷吃失败，加倍偿还 ${paid}`,
          );
        }
      }
    }
  }

  // Dog showdown-survival bonus from bank (not taken from pot)
  for (const dogId of hand.dogArmed) {
    const seat = engine.getPlayer(dogId);
    if (!seat || seat.folded) continue;
    if (engine.street !== "showdown") continue;
    const potBasis = [...won.values()].reduce((a, b) => a + b, 0);
    const bonus = Math.floor(potBasis * 0.2);
    if (bonus > 0) {
      engine.addChipsFromBank(dogId, bonus);
      const ref = players.find((p) => p.id === dogId);
      if (ref) broadcast(hand, ref, `${ref.name} 护食奖金 ${bonus}`);
    }
  }

  // Hamster: if not a winner, refund 20% of total invested — use won map; investment approximated from starting relative hard.
  for (const hamId of hand.hamsterArmed) {
    if ((won.get(hamId) ?? 0) > 0) continue;
    const seat = engine.getPlayer(hamId);
    if (!seat) continue;
    // totalBet was contributed; after showdown we don't have it. Approximate with 0 skip.
    // Room manager should snapshot totalBet before showdown — handled via preSettle snapshot.
  }

  // Bear hug: if the designated target won, caster splits those winnings
  for (const [casterId, targetId] of hand.bearHug) {
    const targetAmt = won.get(targetId) ?? 0;
    if (targetAmt <= 0) continue;
    const target = engine.getPlayer(targetId);
    const caster = engine.getPlayer(casterId);
    if (!target || !caster) continue;
    const half = Math.floor(targetAmt / 2);
    const move = Math.min(half, target.chips);
    if (move <= 0) continue;
    target.chips -= move;
    caster.chips += move;
    const ref = players.find((p) => p.id === casterId);
    if (ref) broadcast(hand, ref, `${ref.name} 依偎平分 ${move}`);
  }

  // Frog flush triple — check winners' hand names
  for (const w of engine.winners ?? []) {
    const p = players.find((x) => x.id === w.playerId);
    if (!p || p.avatarId !== "lizard") continue;
    const seat = engine.getPlayer(w.playerId);
    if (!seat || seat.holeCards.length < 2) continue;
    const handRank = evaluateBestHand([
      ...seat.holeCards,
      ...engine.communityCards,
    ]);
    if (!handRank.name.includes("同花")) continue;
    const extra = w.amount * 2; // already has 1x, need 3x total
    engine.addChipsFromBank(w.playerId, extra);
    broadcast(hand, p, `${p.name} 青一色，额外奖金 ${extra}`);
  }
}

/** Snapshot investments before showdown for hamster. */
export function snapshotInvestments(engine: TexasHoldemEngine): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of engine.players) {
    map.set(p.id, p.totalBet);
  }
  return map;
}

export function applyHamsterAndLionWithSnapshot(opts: {
  engine: TexasHoldemEngine;
  players: SkillPlayerRef[];
  hand: HandSkillState;
  invested: Map<string, number>;
  won: Map<string, number>;
}) {
  const { engine, players, hand, invested, won } = opts;

  for (const hamId of hand.hamsterArmed) {
    if ((won.get(hamId) ?? 0) > 0) continue;
    const investedAmt = invested.get(hamId) ?? 0;
    const refund = Math.floor(investedAmt * 0.2);
    if (refund <= 0) continue;
    engine.addChipsFromBank(hamId, refund);
    const ref = players.find((p) => p.id === hamId);
    if (ref) broadcast(hand, ref, `${ref.name} 存粮拿回 ${refund}`);
  }
}
