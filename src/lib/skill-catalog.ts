import type { AnimalId } from "./types";

export type SkillKind = "active" | "passive";

export type SkillTargetType =
  | "none"
  | "player"
  | "community-card"
  | "upcoming-card"
  | "raise-amount";

export interface AnimalSkillDef {
  animalId: AnimalId;
  skillId: string;
  name: string;
  kind: SkillKind;
  /** Short lobby / modal summary */
  summary: string;
  /** Usage line shown under the title */
  usage: string;
  target: SkillTargetType;
  /** Hands of cooldown after use; 0 = once per hand only */
  cooldownHands?: number;
}

export const SKILL_CATALOG: Record<AnimalId, AnimalSkillDef> = {
  dog: {
    animalId: "dog",
    skillId: "guard-food",
    name: "护食",
    kind: "active",
    usage: "主动 · 每手 1 次 · 仅翻前",
    summary:
      "只要能苟到摊牌，无论输赢都能额外获得20%的筹码奖励。",
    target: "none",
  },
  cat: {
    animalId: "cat",
    skillId: "scout",
    name: "探路",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary:
      "可预览 1 张即将开出的公共牌。翻牌3张时，只能选看1张。",
    target: "upcoming-card",
  },
  mouse: {
    animalId: "mouse",
    skillId: "steal",
    name: "偷吃",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary:
      "偷取一名对手10%的筹码，如果这名玩家赢了，需要双倍偿还。",
    target: "player",
  },
  hamster: {
    animalId: "hamster",
    skillId: "stash",
    name: "存粮",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "本手即使没赢，也可拿回自己本手总投入的 20%。",
    target: "none",
  },
  rabbit: {
    animalId: "rabbit",
    skillId: "slip-away",
    name: "开溜",
    kind: "passive",
    usage: "被动 · 弃牌时",
    summary: "弃牌时可以拿回已投入筹码的一半。",
    target: "none",
  },
  fox: {
    animalId: "fox",
    skillId: "fraud",
    name: "欺诈",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "虚假下注，其实只是跟注。",
    target: "raise-amount",
  },
  bear: {
    animalId: "bear",
    skillId: "bear-hug",
    name: "熊抱",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "选择一名玩家，如果ta赢了，可以和ta平分赢得的筹码。",
    target: "player",
  },
  panda: {
    animalId: "panda",
    skillId: "harmony",
    name: "和谐",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "本回合里，之后行动的玩家无法加注。",
    target: "none",
  },
  "polar-bear": {
    animalId: "polar-bear",
    skillId: "freeze",
    name: "冰封",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "指定一名玩家，本手ta不能加注。",
    target: "player",
  },
  koala: {
    animalId: "koala",
    skillId: "doze",
    name: "装睡",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "本回合当过牌，即使有人下注也能装睡过掉。",
    target: "none",
  },
  tiger: {
    animalId: "tiger",
    skillId: "roar",
    name: "发威",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "从每一名未弃牌玩家那随机抽取一张牌，洗混后再随机发还。",
    target: "none",
  },
  lion: {
    animalId: "lion",
    skillId: "duel",
    name: "单挑",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "指定一名玩家，谁先弃牌就要给对方5%的筹码。",
    target: "player",
  },
  cow: {
    animalId: "cow",
    skillId: "ruminate",
    name: "反刍",
    kind: "passive",
    usage: "被动 · 每翻牌",
    summary: "只要不弃牌，每翻一次牌，都能获得持有筹码的5%。",
    target: "none",
  },
  pig: {
    animalId: "pig",
    skillId: "root",
    name: "拱菜",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "选择一张已经开牌的公共牌丢弃，从牌堆补一张。",
    target: "community-card",
  },
  frog: {
    animalId: "frog",
    skillId: "flush-bonus",
    name: "青一色",
    kind: "passive",
    usage: "被动 · 同花/同花顺获胜",
    summary: "以同花或同花顺获胜时，赢得筹码翻三倍。",
    target: "none",
  },
  dragon: {
    animalId: "dragon",
    skillId: "tail-sweep",
    name: "摆尾",
    kind: "active",
    usage: "主动 · 每手 1 次",
    summary: "丢弃自己的手牌，抽取两张新的。",
    target: "none",
  },
};

export function getAnimalSkill(animalId: AnimalId): AnimalSkillDef {
  return SKILL_CATALOG[animalId];
}
