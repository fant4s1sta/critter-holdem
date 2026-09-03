/** Shared client/server types for Critter Hold'em multiplayer rooms */

export type GameTypeId = "texas-holdem";
export type RuleMode = "classic" | "skill";

export type AnimalId =
  | "dog"
  | "cat"
  | "mouse"
  | "hamster"
  | "rabbit"
  | "fox"
  | "bear"
  | "panda"
  | "polar-bear"
  | "koala"
  | "tiger"
  | "lion"
  | "cow"
  | "pig"
  | "frog"
  | "dragon";

export const ANIMALS: { id: AnimalId; name: string; emoji: string }[] = [
  { id: "dog", name: "小狗", emoji: "🐶" },
  { id: "cat", name: "小猫", emoji: "🐱" },
  { id: "mouse", name: "老鼠", emoji: "🐭" },
  { id: "hamster", name: "仓鼠", emoji: "🐹" },
  { id: "rabbit", name: "兔子", emoji: "🐰" },
  { id: "fox", name: "狐狸", emoji: "🦊" },
  { id: "bear", name: "小熊", emoji: "🐻" },
  { id: "panda", name: "熊猫", emoji: "🐼" },
  { id: "polar-bear", name: "北极熊", emoji: "🐻‍❄️" },
  { id: "koala", name: "考拉", emoji: "🐨" },
  { id: "tiger", name: "老虎", emoji: "🐯" },
  { id: "lion", name: "狮子", emoji: "🦁" },
  { id: "cow", name: "奶牛", emoji: "🐮" },
  { id: "pig", name: "小猪", emoji: "🐷" },
  { id: "frog", name: "青蛙", emoji: "🐸" },
  { id: "dragon", name: "龙", emoji: "🐲" },
];

export type RoomStatus = "lobby" | "playing" | "finished";

export type Suit = "s" | "h" | "d" | "c";
export type Rank =
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "T"
  | "J"
  | "Q"
  | "K"
  | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";

export type PlayerActionType =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all-in";

export interface PlayerIdentity {
  playerId: string;
  secret: string;
  name: string;
  /** null = not chosen yet (show ? in lobby); assigned on start if still null */
  avatarId: AnimalId | null;
  spectator?: boolean;
}

export interface PublicPlayer {
  id: string;
  name: string;
  /** null while waiting in lobby without a pick */
  avatarId: AnimalId | null;
  seat: number;
  chips: number;
  connected: boolean;
  away: boolean;
  /** True when AI is currently deciding/acting for this seat */
  aiControlled: boolean;
  isHost: boolean;
  /** In-hand status while playing */
  folded?: boolean;
  allIn?: boolean;
  betThisStreet?: number;
  holeCards?: Card[] | null;
  holeCardCount?: number;
}

export interface GameActionPayload {
  type: PlayerActionType;
  amount?: number;
}

export interface TexasHoldemPublicState {
  gameType: "texas-holdem";
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
  actingPlayerId: string | null;
  turnEndsAt: number | null;
  nextHandAt?: number | null;
  smallBlind: number;
  bigBlind: number;
  winners?: { playerId: string; amount: number; handName?: string }[];
  /** Everyone dealt this hand, published at showdown for the result modal. */
  handSummary?: {
    playerId: string;
    holeCards: Card[];
    handName?: string;
    folded: boolean;
    winAmount: number;
  }[];
  lastAction?: {
    playerId: string;
    playerName: string;
    type: PlayerActionType | "blind" | "deal";
    amount?: number;
    ai?: boolean;
  };
}

export interface SkillPublicState {
  /** Whether this viewer may open/use the skill button now */
  canUseActive: boolean;
  /** Active skill already used this hand */
  usedThisHand: boolean;
  /** Remaining hands before polar-bear etc. can fire again (0 = ready) */
  cooldownHandsLeft: number;
  /** Disable reason when canUseActive is false */
  disabledReason?: string;
  /** Private scout preview for cat — at most one card */
  scoutCards?: Card[] | null;
  /** Community slot (0–4) the peeked card belongs to */
  scoutSlot?: number | null;
  /** Last public skill broadcast */
  lastSkillEvent?: {
    animalId: AnimalId;
    skillName: string;
    playerId: string;
    playerName: string;
    text: string;
  } | null;
}

export interface RoomPublicState {
  code: string;
  /** Monotonic room revision — full sync on reconnect, patches must be sequential. */
  rev?: number;
  status: RoomStatus;
  gameType: GameTypeId;
  /** classic = traditional holdem; skill = animal skills enabled */
  ruleMode: RuleMode;
  hostId: string;
  maxPlayers: number;
  players: PublicPlayer[];
  you: {
    playerId: string;
    seat: number;
    spectator: boolean;
    canAct: boolean;
    callAmount: number;
    minRaiseTo: number;
    maxRaiseTo: number;
    /** Present only in skill mode for seated players */
    skill?: SkillPublicState | null;
  } | null;
  game: TexasHoldemPublicState | null;
  message?: string;
}

/** Partial player update keyed by id */
export type PublicPlayerPatch = Partial<PublicPlayer> & { id: string };

/** Incremental room update — merge over the last full/patch state with the same rev chain */
export interface RoomPatch {
  rev: number;
  code: string;
  status?: RoomStatus;
  hostId?: string;
  game?: Partial<TexasHoldemPublicState> | null;
  players?: PublicPlayerPatch[];
  you?: RoomPublicState["you"];
  message?: string;
}

export type RoomBroadcastPayload =
  | { type: "full"; socketId: string; state: RoomPublicState }
  | { type: "patch"; socketId: string; patch: RoomPatch };

export const GAME_CATALOG: {
  id: GameTypeId;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}[] = [
  {
    id: "texas-holdem",
    name: "经典德州",
    description: "传统德州扑克规则，无动物技能",
    minPlayers: 2,
    maxPlayers: 10,
  },
];

export const RULE_MODE_OPTIONS: {
  id: RuleMode;
  name: string;
  description: string;
}[] = [
  {
    id: "classic",
    name: "经典模式",
    description: "传统德州扑克，专注牌力与下注",
  },
  {
    id: "skill",
    name: "技能模式",
    description: "每只动物绑定专属技能，名场面拉满",
  },
];
