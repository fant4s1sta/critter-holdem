import type { CritterKind } from "./critters";

type Suit = "s" | "h" | "d" | "c";
type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface PlayerIdentity {
  playerId: string;
  secret: string;
  name: string;
}

export interface PublicPlayer {
  critter: CritterKind;
  id: string;
  name: string;
  seat: number;
  chips: number;
  isHost: boolean;
  connected: boolean;
  aiControlled: boolean;
  folded: boolean;
  allIn: boolean;
  betThisStreet: number;
  totalBetChips: number[];
  holeCards: Card[] | null;
  holeCardCount: number;
}

export interface GameActionPayload {
  type: "fold" | "check" | "call" | "bet" | "raise" | "all-in";
  amount?: number;
  chipCounts?: number[];
}

export interface RoomPublicState {
  code: string;
  status: "lobby" | "playing" | "finished";
  maxPlayers: number;
  players: PublicPlayer[];
  you: {
    playerId: string;
    spectator: boolean;
    canAct: boolean;
    canRaise: boolean;
    callAmount: number;
    minRaiseTo: number;
  };
  game: {
    handNumber: number;
    street: "preflop" | "flop" | "turn" | "river" | "showdown";
    communityCards: Card[];
    pot: number;
    currentBet: number;
    actingPlayerId?: string;
    turn: number;
    nextHandAt?: number;
    winners?: { playerId: string; amount: number; handName?: string }[];
  } | null;
  serverNow: number;
}
