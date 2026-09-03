import type { PlayerIdentity } from "../../src/lib/types";
import type { Room, RoomPlayer } from "../room-manager";
import type { HandSkillState } from "../games/skill-mode/skill-runtime";
import {
  TexasHoldemEngine,
  type TexasHoldemEngineSnapshot,
} from "../games/texas-holdem/engine";

type PersistedPlayer = Omit<
  RoomPlayer,
  "socketId" | "disconnectTimer"
> & { awayUntil?: number };

type PersistedSkillState = {
  usedActive: string[];
  cooldownLeft: [string, number][];
  dogArmed: string[];
  hamsterArmed: string[];
  mouseSteal: [string, { targetId: string; amount: number }][];
  bearHug: [string, string][];
  lionDuel: [string, string][];
  lionDuelSettled: string[];
  freezeNoRaise: string[];
  pandaHarmony: HandSkillState["pandaHarmony"];
  checkedThisStreet: string[];
  privateScout: [string, HandSkillState["privateScout"] extends Map<string, infer V> ? V : never][];
  privateScoutSlot?: [string, number][];
  fraudEscrow: [string, number][];
  lastEvent: HandSkillState["lastEvent"];
  handWon: [string, number][];
};

export interface RoomSnapshot {
  code: string;
  hostId: string;
  gameType: Room["gameType"];
  ruleMode: Room["ruleMode"];
  status: Room["status"];
  maxPlayers: number;
  minPlayers: number;
  players: PersistedPlayer[];
  spectators: PlayerIdentity[];
  engine: TexasHoldemEngineSnapshot | null;
  skillHand: PersistedSkillState | null;
  lastStreet: string | null;
  createdAt: number;
  nextHandAt?: number;
  rev: number;
}

export function serializeRoom(room: Room, rev: number): RoomSnapshot {
  return structuredClone({
    code: room.code,
    hostId: room.hostId,
    gameType: room.gameType,
    ruleMode: room.ruleMode,
    status: room.status,
    maxPlayers: room.maxPlayers,
    minPlayers: room.minPlayers,
    players: [...room.players.values()].map((source) => {
      const player = { ...source };
      delete player.socketId;
      delete player.disconnectTimer;
      return player;
    }),
    spectators: [...room.spectators.values()],
    engine: room.engine?.toSnapshot() ?? null,
    skillHand: room.skillHand ? serializeSkillState(room.skillHand) : null,
    lastStreet: room.lastStreet,
    createdAt: room.createdAt,
    nextHandAt: room.nextHandAt,
    rev,
  });
}

export function restoreRoom(snapshot: RoomSnapshot): Room {
  return {
    code: snapshot.code,
    hostId: snapshot.hostId,
    gameType: snapshot.gameType,
    ruleMode: snapshot.ruleMode,
    status: snapshot.status,
    maxPlayers: snapshot.maxPlayers,
    minPlayers: snapshot.minPlayers,
    players: new Map(snapshot.players.map((player) => [player.id, { ...player }])),
    spectators: new Map(snapshot.spectators.map((spectator) => [spectator.playerId, spectator])),
    spectatorSockets: new Map(),
    engine: snapshot.engine
      ? TexasHoldemEngine.fromSnapshot(snapshot.engine)
      : null,
    skillHand: snapshot.skillHand
      ? restoreSkillState(snapshot.skillHand)
      : null,
    lastStreet: snapshot.lastStreet,
    createdAt: snapshot.createdAt,
    nextHandAt: snapshot.nextHandAt,
  };
}

function serializeSkillState(state: HandSkillState): PersistedSkillState {
  return {
    usedActive: [...state.usedActive],
    cooldownLeft: [...state.cooldownLeft],
    dogArmed: [...state.dogArmed],
    hamsterArmed: [...state.hamsterArmed],
    mouseSteal: [...state.mouseSteal],
    bearHug: [...state.bearHug],
    lionDuel: [...state.lionDuel],
    lionDuelSettled: [...state.lionDuelSettled],
    freezeNoRaise: [...state.freezeNoRaise],
    pandaHarmony: state.pandaHarmony,
    checkedThisStreet: [...state.checkedThisStreet],
    privateScout: [...state.privateScout],
    privateScoutSlot: [...state.privateScoutSlot],
    fraudEscrow: [...state.fraudEscrow],
    lastEvent: state.lastEvent,
    handWon: [...state.handWon],
  };
}

function restoreSkillState(snapshot: PersistedSkillState): HandSkillState {
  return {
    usedActive: new Set(snapshot.usedActive),
    cooldownLeft: new Map(snapshot.cooldownLeft),
    dogArmed: new Set(snapshot.dogArmed),
    hamsterArmed: new Set(snapshot.hamsterArmed),
    mouseSteal: new Map(snapshot.mouseSteal),
    bearHug: new Map(snapshot.bearHug),
    lionDuel: new Map(snapshot.lionDuel),
    lionDuelSettled: new Set(snapshot.lionDuelSettled),
    freezeNoRaise: new Set(snapshot.freezeNoRaise),
    pandaHarmony: snapshot.pandaHarmony,
    checkedThisStreet: new Set(snapshot.checkedThisStreet),
    privateScout: new Map(snapshot.privateScout),
    privateScoutSlot: new Map(snapshot.privateScoutSlot ?? []),
    fraudEscrow: new Map(snapshot.fraudEscrow),
    lastEvent: snapshot.lastEvent,
    handWon: new Map(snapshot.handWon),
  };
}
