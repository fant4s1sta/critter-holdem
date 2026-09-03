import { randomBytes, randomInt, randomUUID } from "crypto";
import type {
  GameActionPayload,
  AnimalId,
  GameTypeId,
  PlayerIdentity,
  PublicPlayer,
  RoomBroadcastPayload,
  RoomPublicState,
  RoomStatus,
  RuleMode,
  TexasHoldemPublicState,
} from "../src/lib/types";
import { ANIMALS, GAME_CATALOG } from "../src/lib/types";
import { pickNextAvailableAvatar } from "../src/lib/bot-optimistic";
import { shouldRevealHoleCards } from "../src/lib/reveal-hole-cards";
import {
  diffRoomState,
  shouldForceFullSync,
} from "../src/lib/room-state-sync";
import { chooseAiAction } from "./games/texas-holdem/ai";
import { TexasHoldemEngine } from "./games/texas-holdem/engine";
import {
  applyCowRuminate,
  applyHamsterAndLionWithSnapshot,
  applyLionDuelOnFold,
  applyRabbitOnFold,
  buildViewerSkillState,
  createHandSkillState,
  isRaiseBlockedBySkills,
  nextHandSkillState,
  onPlayerChecked,
  onStreetChanged,
  settleHandSkills,
  snapshotInvestments,
  useActiveSkill,
  type HandSkillState,
  type SkillPlayerRef,
} from "./games/skill-mode/skill-runtime";
import {
  MemoryRoomRepository,
  type RoomRepository,
} from "./persistence/room-repository";
import {
  restoreRoom,
  serializeRoom,
  type RoomSnapshot,
} from "./persistence/room-snapshot";

const STARTING_CHIPS = 1000;
/** Mobile tabs often need longer than 2.5s to resume the websocket. */
const AWAY_GRACE_MS = 12_000;
/** Extra cushion after the between-hands pause before marking away. */
const AWAY_AFTER_PAUSE_MS = 3_000;
const BETWEEN_HANDS_MS = 5000;
/** Artificial "thinking" pause before a bot / away player acts. */
const AI_THINK_MS = 600;

export interface RoomPlayer {
  id: string;
  secret: string;
  name: string;
  /** null until the player picks (or random assign at start) */
  avatarId: AnimalId | null;
  seat: number;
  chips: number;
  connected: boolean;
  away: boolean;
  isBot: boolean;
  isHost: boolean;
  spectator: boolean;
  socketId?: string;
  disconnectTimer?: ReturnType<typeof setTimeout>;
  awayUntil?: number;
}

export interface Room {
  code: string;
  hostId: string;
  gameType: GameTypeId;
  ruleMode: RuleMode;
  status: RoomStatus;
  maxPlayers: number;
  minPlayers: number;
  players: Map<string, RoomPlayer>;
  spectators: Map<string, PlayerIdentity>;
  spectatorSockets: Map<string, string>;
  engine: TexasHoldemEngine | null;
  skillHand: HandSkillState | null;
  lastStreet: string | null;
  createdAt: number;
  nextHandAt?: number;
  handPauseTimer?: ReturnType<typeof setTimeout>;
  turnWatchTimer?: ReturnType<typeof setInterval>;
  aiActionTimer?: ReturnType<typeof setTimeout>;
}

function makeCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function makeIdentity(
  name: string,
  avatarId: AnimalId | null = null,
  spectator = false,
): PlayerIdentity {
  return {
    playerId: randomUUID(),
    secret: randomBytes(24).toString("hex"),
    name: name.trim().slice(0, 16) || "玩家",
    avatarId,
    spectator,
  };
}

function isAnimalId(id: unknown): id is AnimalId {
  return typeof id === "string" && ANIMALS.some((a) => a.id === id);
}

/** Prefer unused animals; fall back to any if all taken. */
function pickRandomAvatar(used: Set<AnimalId>): AnimalId {
  const free = ANIMALS.filter((a) => !used.has(a.id));
  const pool = free.length > 0 ? free : ANIMALS;
  return pool[randomInt(0, pool.length)].id;
}

function usedAvatars(room: Room): Set<AnimalId> {
  const used = new Set<AnimalId>();
  for (const p of room.players.values()) {
    if (p.avatarId) used.add(p.avatarId);
  }
  return used;
}

function assignMissingAvatars(room: Room) {
  const used = usedAvatars(room);
  for (const p of room.players.values()) {
    if (p.avatarId) continue;
    const next = pickRandomAvatar(used);
    p.avatarId = next;
    used.add(next);
  }
}

function addBotPlayer(room: Room): string {
  if (room.players.size >= room.maxPlayers) {
    throw new Error("房间已满");
  }
  const usedSeats = new Set([...room.players.values()].map((p) => p.seat));
  let seat = 0;
  while (usedSeats.has(seat)) seat += 1;
  const avatarId = pickNextAvailableAvatar(usedAvatars(room));
  const animal = ANIMALS.find((a) => a.id === avatarId)!;
  const id = randomUUID();
  room.players.set(id, {
    id,
    secret: randomBytes(8).toString("hex"),
    name: animal.name,
    avatarId,
    seat,
    chips: STARTING_CHIPS,
    connected: true,
    away: true,
    isBot: true,
    isHost: false,
    spectator: false,
  });
  return id;
}

type EmitRoom = (code: string, options?: { forceFull?: boolean }) => void;

export interface RoomManagerOptions {
  /** Broadcast the in-memory room to sockets on this instance. */
  emitRoom: EmitRoom;
  repository?: RoomRepository<RoomSnapshot>;
  /**
   * Called once a revision has been durably written. Use it to notify other
   * instances — they must only re-hydrate after the store has the new state.
   */
  onPersisted?: (code: string, options: { forceFull: boolean }) => void;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private revisions = new Map<string, number>();
  private snapshots = new Map<string, Map<string, RoomPublicState>>();
  private emitRoom: EmitRoom;
  private onPersisted?: RoomManagerOptions["onPersisted"];
  private readonly repository: RoomRepository<RoomSnapshot>;
  private readonly persistenceEnabled: boolean;
  private pendingWrites = new Set<Promise<void>>();
  private writeQueues = new Map<string, Promise<void>>();
  /** Bumped when a write fails so queued writes built on the bad rev are dropped. */
  private writeGenerations = new Map<string, number>();

  constructor(emitRoomOrOptions: EmitRoom | RoomManagerOptions) {
    this.emitRoom =
      typeof emitRoomOrOptions === "function"
        ? emitRoomOrOptions
        : emitRoomOrOptions.emitRoom;
    this.onPersisted =
      typeof emitRoomOrOptions === "function"
        ? undefined
        : emitRoomOrOptions.onPersisted;
    this.repository =
      typeof emitRoomOrOptions === "function"
        ? new MemoryRoomRepository<RoomSnapshot>()
        : (emitRoomOrOptions.repository ??
          new MemoryRoomRepository<RoomSnapshot>());
    this.persistenceEnabled = typeof emitRoomOrOptions !== "function";
  }

  /**
   * Broadcast first, persist afterwards (write-behind). Clients only wait on
   * their own socket RTT. A failed compare-and-set reloads from the in-memory
   * store and force-syncs viewers instead of surfacing the conflict.
   */
  private publish(code: string, forceFull = false) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    if (!this.persistenceEnabled) {
      this.emitRoom(code, { forceFull });
      return;
    }
    const currentRev = this.revisions.get(room.code) ?? 0;
    const nextRev = currentRev + 1;
    this.revisions.set(room.code, nextRev);
    this.emitRoom(code, { forceFull });

    const snapshot = serializeRoom(room, nextRev);
    this.enqueueWrite(room.code, async () => {
      await this.repository.set(room.code, snapshot, currentRev);
      this.onPersisted?.(room.code, { forceFull });
    });
  }

  private enqueueWrite(code: string, op: () => Promise<void>) {
    const generation = this.writeGenerations.get(code) ?? 0;
    const previous = this.writeQueues.get(code) ?? Promise.resolve();
    const write = previous.then(async () => {
      if ((this.writeGenerations.get(code) ?? 0) !== generation) return;
      try {
        await op();
      } catch (error) {
        await this.recoverFromWriteFailure(code, generation, error);
      }
    });
    this.writeQueues.set(code, write);
    this.pendingWrites.add(write);
    void write.finally(() => {
      this.pendingWrites.delete(write);
      if (this.writeQueues.get(code) === write) {
        this.writeQueues.delete(code);
      }
    });
  }

  private async recoverFromWriteFailure(
    code: string,
    generation: number,
    error: unknown,
  ) {
    if ((this.writeGenerations.get(code) ?? 0) !== generation) return;
    this.writeGenerations.set(code, generation + 1);
    console.warn(
      `[rooms] persist failed for ${code}, resyncing:`,
      error instanceof Error ? error.message : error,
    );
    try {
      if (await this.hydrate(code, true)) {
        this.emitRoom(code, { forceFull: true });
        return;
      }
      // Snapshot is gone: re-seed it from memory,
      // keeping the current revision so client patch numbering stays monotonic.
      const room = this.rooms.get(code);
      if (!room) return;
      const rev = this.revisions.get(code) ?? 1;
      await this.repository.set(code, serializeRoom(room, rev), null);
      this.emitRoom(code, { forceFull: true });
      this.onPersisted?.(code, { forceFull: true });
    } catch (recoverError) {
      console.error(
        `[rooms] resync failed for ${code}:`,
        recoverError instanceof Error ? recoverError.message : recoverError,
      );
    }
  }

  async hydrate(code: string, force = false): Promise<boolean> {
    const roomCode = code.toUpperCase();
    if (this.rooms.has(roomCode) && !force) return true;
    const snapshot = await this.repository.get(roomCode);
    if (!snapshot) return false;
    const current = this.rooms.get(roomCode);
    if (current) this.clearRuntimeTimers(current);
    const restored = restoreRoom(snapshot);
    if (current) {
      for (const player of restored.players.values()) {
        const local = current.players.get(player.id);
        if (local) {
          player.socketId = local.socketId;
          player.disconnectTimer = local.disconnectTimer;
          player.connected = local.connected;
        }
      }
      restored.spectatorSockets = new Map(current.spectatorSockets);
    }
    this.rooms.set(roomCode, restored);
    this.revisions.set(roomCode, snapshot.rev);
    this.restoreTimers(restored);
    return true;
  }

  async flushPersistence(): Promise<void> {
    await Promise.all(this.pendingWrites);
  }

  private cloneState(state: RoomPublicState): RoomPublicState {
    return structuredClone(state);
  }

  private snapshotForViewer(code: string, viewerId: string, state: RoomPublicState) {
    let byViewer = this.snapshots.get(code);
    if (!byViewer) {
      byViewer = new Map();
      this.snapshots.set(code, byViewer);
    }
    byViewer.set(viewerId, this.cloneState(state));
  }

  collectEmissions(
    code: string,
    options?: { forceFull?: boolean },
  ): RoomBroadcastPayload[] {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return [];

    const nextRev = this.revisions.get(code) ?? 0;
    const forceFull = options?.forceFull ?? false;
    let byViewer = this.snapshots.get(code);
    if (!byViewer) {
      byViewer = new Map();
      this.snapshots.set(code, byViewer);
    }

    const emissions: RoomBroadcastPayload[] = [];
    const roomKey = code.toUpperCase();
    const sharedFrame = this.buildSharedFrame(room);

    for (const viewerId of this.listViewerIds(code)) {
      const socketId = this.getSocketId(code, viewerId);
      if (!socketId) continue;

      const next = this.buildPublicStateFromFrame(
        room,
        sharedFrame,
        viewerId,
        nextRev,
      );
      if (!next) continue;

      const prev = byViewer.get(viewerId);
      const sendFull =
        forceFull || !prev || shouldForceFullSync(prev, next);

      if (sendFull) {
        emissions.push({ type: "full", socketId, state: next });
        byViewer.set(viewerId, this.cloneState(next));
        continue;
      }

      const patch = diffRoomState(prev, next, nextRev);
      if (!patch) continue;

      emissions.push({ type: "patch", socketId, patch });
      byViewer.set(viewerId, this.cloneState(next));
    }

    this.snapshots.set(roomKey, byViewer);
    return emissions;
  }

  createRoom(input: {
    name: string;
    gameType?: GameTypeId;
    ruleMode?: RuleMode;
    mode?: "multi" | "single";
    aiCount?: number;
  }): { identity: PlayerIdentity; room: RoomPublicState } {
    const gameType = input.gameType ?? "texas-holdem";
    const ruleMode = input.ruleMode ?? "classic";
    const catalog = GAME_CATALOG.find((g) => g.id === gameType);
    if (!catalog) throw new Error("不支持的游戏类型");

    let code = makeCode();
    while (this.rooms.has(code)) code = makeCode();

    const identity = makeIdentity(input.name, null);
    const player: RoomPlayer = {
      id: identity.playerId,
      secret: identity.secret,
      name: identity.name,
      avatarId: null,
      seat: 0,
      chips: STARTING_CHIPS,
      connected: true,
      away: false,
      isBot: false,
      isHost: true,
      spectator: false,
    };

    const room: Room = {
      code,
      hostId: player.id,
      gameType,
      ruleMode,
      status: "lobby",
      maxPlayers: catalog.maxPlayers,
      minPlayers: catalog.minPlayers,
      players: new Map([[player.id, player]]),
      spectators: new Map(),
      spectatorSockets: new Map(),
      engine: null,
      skillHand: null,
      lastStreet: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    const requestedAi =
      input.aiCount ?? (input.mode === "single" ? 3 : 0);
    const count = Math.min(
      room.maxPlayers - 1,
      Math.max(0, requestedAi),
    );
    for (let i = 0; i < count; i += 1) {
      addBotPlayer(room);
    }
    if (this.persistenceEnabled) {
      const initial = serializeRoom(room, 0);
      this.enqueueWrite(code, () => this.repository.set(code, initial, null));
    }
    this.revisions.set(code, 0);
    const state = this.getPublicState(code, player.id)!;
    this.snapshotForViewer(code, player.id, state);
    return { identity, room: state };
  }

  joinRoom(input: {
    code: string;
    name: string;
  }): { identity: PlayerIdentity; spectator?: boolean; room: RoomPublicState } {
    const room = this.rooms.get(input.code.toUpperCase());
    if (!room) throw new Error("房间不存在");
    if (room.status !== "lobby") {
      const identity = makeIdentity(input.name, null, true);
      room.spectators.set(identity.playerId, identity);
      const state = this.getPublicState(room.code, identity.playerId)!;
      this.snapshotForViewer(room.code, identity.playerId, state);
      return { identity, spectator: true, room: state };
    }
    if (room.players.size >= room.maxPlayers) throw new Error("房间已满");

    const identity = makeIdentity(input.name, null);
    const usedSeats = new Set([...room.players.values()].map((p) => p.seat));
    let seat = 0;
    while (usedSeats.has(seat)) seat += 1;

    const player: RoomPlayer = {
      id: identity.playerId,
      secret: identity.secret,
      name: identity.name,
      avatarId: null,
      seat,
      chips: STARTING_CHIPS,
      connected: true,
      away: false,
      isBot: false,
      isHost: false,
      spectator: false,
    };
    room.players.set(player.id, player);
    const state = this.getPublicState(room.code, player.id)!;
    this.snapshotForViewer(room.code, player.id, state);
    this.publish(room.code, true);
    return { identity, room: state };
  }

  addBot(code: string, requesterId: string, secret: string): PublicPlayer {
    const room = this.requireRoom(code);
    const requester = room.players.get(requesterId);
    if (!requester || requester.secret !== secret) throw new Error("无权操作");
    if (room.hostId !== requesterId) throw new Error("只有房主可以添加 AI");
    if (room.status !== "lobby") throw new Error("对局中无法添加 AI");
    const botId = addBotPlayer(room);
    this.publish(room.code, true);
    const state = this.getPublicState(code, requesterId);
    if (!state) throw new Error("房间不存在");
    const bot = state.players.find((player) => player.id === botId);
    if (!bot) throw new Error("内部错误：无法读取 AI 玩家");
    return bot;
  }

  bindSocket(code: string, playerId: string, socketId: string) {
    const room = this.requireRoom(code);
    const player = room.players.get(playerId);
    if (!player) throw new Error("玩家不在房间");
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = undefined;
    }
    player.socketId = socketId;
    player.connected = true;
    if (!player.isBot) player.away = false;
    this.publish(room.code);
    this.maybeScheduleAi(room);
  }

  reconnect(input: {
    code: string;
    playerId: string;
    secret: string;
    socketId: string;
  }): RoomPublicState {
    const room = this.rooms.get(input.code.toUpperCase());
    if (!room) throw new Error("房间不存在或已解散");
    const player = room.players.get(input.playerId);
    if (player) {
      if (player.secret !== input.secret) throw new Error("身份校验失败，无法重连");
      this.bindSocket(room.code, player.id, input.socketId);
      const state = this.getPublicState(room.code, player.id)!;
      this.snapshotForViewer(room.code, player.id, state);
      return state;
    }
    const spectator = room.spectators.get(input.playerId);
    if (!spectator || spectator.secret !== input.secret) {
      throw new Error("身份校验失败，无法重连");
    }
    room.spectatorSockets.set(spectator.playerId, input.socketId);
    const state = this.getPublicState(room.code, spectator.playerId)!;
    this.snapshotForViewer(room.code, spectator.playerId, state);
    return state;
  }

  bindSpectator(code: string, spectatorId: string, socketId: string) {
    const room = this.requireRoom(code);
    if (!room.spectators.has(spectatorId)) throw new Error("观战身份不存在");
    room.spectatorSockets.set(spectatorId, socketId);
    this.publish(room.code);
  }

  handleDisconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      for (const [spectatorId, boundSocketId] of room.spectatorSockets) {
        if (boundSocketId === socketId) room.spectatorSockets.delete(spectatorId);
      }
      for (const player of room.players.values()) {
        if (player.socketId !== socketId) continue;
        player.connected = false;
        player.socketId = undefined;
        if (player.isBot) continue;
        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        const graceMs = this.awayGraceMs(room);
        player.disconnectTimer = setTimeout(() => {
          player.disconnectTimer = undefined;
          // Reconnected before the grace elapsed.
          if (player.connected || player.socketId) return;
          player.away = true;
          this.publish(room.code);
          this.maybeScheduleAi(room);
        }, graceMs);
        this.publish(room.code);
      }
    }
  }

  /** Longer grace while waiting for the next hand so mobile backgrounding is less punishing. */
  private awayGraceMs(room: Room): number {
    const pauseUntil = room.nextHandAt;
    if (pauseUntil && pauseUntil > Date.now()) {
      return Math.max(
        AWAY_GRACE_MS,
        pauseUntil - Date.now() + AWAY_AFTER_PAUSE_MS,
      );
    }
    return AWAY_GRACE_MS;
  }

  canResume(code: string, playerId: string, secret: string): boolean {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return false;
    const player = room.players.get(playerId);
    if (player && player.secret === secret) return true;
    const spectator = room.spectators.get(playerId);
    return !!spectator && spectator.secret === secret;
  }

  leaveRoom(code: string, playerId: string, secret: string) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player || player.secret !== secret) throw new Error("无权离开");

    if (room.status === "playing" && room.engine) {
      // Soft leave: mark permanently away (AI continues), do not free seat mid-hand
      player.connected = false;
      player.away = true;
      player.socketId = undefined;
      this.publish(room.code);
      this.maybeScheduleAi(room);
      return;
    }

    room.players.delete(playerId);
    if (room.players.size === 0) {
      this.destroyRoom(room);
      return;
    }
    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((p) => !p.isBot);
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.id;
      }
    }
    this.publish(room.code);
  }

  setAvatar(
    code: string,
    playerId: string,
    secret: string,
    avatarId: AnimalId,
  ): PlayerIdentity {
    const room = this.requireRoom(code);
    const player = room.players.get(playerId);
    if (!player || player.secret !== secret) throw new Error("无权操作");
    if (player.isBot) throw new Error("无法为 AI 选择动物");
    if (room.status !== "lobby") throw new Error("对局已开始，无法更换动物");
    if (!isAnimalId(avatarId)) throw new Error("无效的动物");
    player.avatarId = avatarId;
    this.publish(room.code);
    return {
      playerId: player.id,
      secret: player.secret,
      name: player.name,
      avatarId: player.avatarId,
      spectator: false,
    };
  }

  startGame(code: string, requesterId: string, secret: string) {
    const room = this.requireRoom(code);
    const requester = room.players.get(requesterId);
    if (!requester || requester.secret !== secret) throw new Error("无权操作");
    if (room.hostId !== requesterId) throw new Error("只有房主可以开始");
    if (room.status === "playing") throw new Error("已经在对局中");
    const humansAndBots = [...room.players.values()];
    if (humansAndBots.length < room.minPlayers) {
      throw new Error(`至少需要 ${room.minPlayers} 名玩家`);
    }
    assignMissingAvatars(room);
    room.status = "playing";
    for (const player of room.players.values()) {
      player.chips = STARTING_CHIPS;
    }
    room.engine = new TexasHoldemEngine();
    room.skillHand =
      room.ruleMode === "skill" ? createHandSkillState() : null;
    room.lastStreet = null;
    this.beginHand(room);
  }

  private beginHand(room: Room) {
    if (!room.engine) return;
    room.nextHandAt = undefined;
    if (room.handPauseTimer) {
      clearTimeout(room.handPauseTimer);
      room.handPauseTimer = undefined;
    }
    // Anyone still disconnected when the next hand starts is hosted by AI.
    for (const player of room.players.values()) {
      if (player.isBot) continue;
      if (!player.connected && !player.socketId) {
        player.away = true;
        if (player.disconnectTimer) {
          clearTimeout(player.disconnectTimer);
          player.disconnectTimer = undefined;
        }
      }
    }
    if (room.ruleMode === "skill") {
      room.skillHand = nextHandSkillState(room.skillHand);
    } else {
      room.skillHand = null;
    }
    const seated = [...room.players.values()]
      .filter((p) => p.chips > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        seat: p.seat,
        chips: p.chips,
        away: p.away || p.isBot,
      }));
    if (seated.length < 2) {
      room.status = "finished";
      this.publish(room.code);
      return;
    }
    room.engine.startHand(seated);
    room.lastStreet = room.engine.street;
    this.syncEngineChips(room);
    this.ensureTurnWatcher(room);
    this.publish(room.code);
    this.maybeScheduleAi(room);
  }

  applyAction(
    code: string,
    playerId: string,
    secret: string,
    action: GameActionPayload,
  ) {
    const room = this.requireRoom(code);
    const player = room.players.get(playerId);
    if (!player || player.secret !== secret) throw new Error("无权操作");
    if (!room.engine || room.status !== "playing") {
      throw new Error("对局未开始");
    }
    if (player.away) throw new Error("你处于离线状态，由 AI 代打；重连后可恢复");

    if (
      room.ruleMode === "skill" &&
      isRaiseBlockedBySkills(
        room.skillHand,
        room.engine,
        playerId,
        action.type,
      )
    ) {
      throw new Error("当前不能加注");
    }

    const prevStreet = room.engine.street;
    room.engine.applyAction(playerId, action.type, action.amount, { ai: false });

    if (room.ruleMode === "skill" && room.skillHand) {
      if (action.type === "check") {
        onPlayerChecked(room.skillHand, playerId);
      }
      if (action.type === "fold") {
        applyRabbitOnFold(
          room.engine,
          this.toSkillRef(player),
          room.skillHand,
        );
        applyLionDuelOnFold(
          room.engine,
          this.skillPlayerRefs(room),
          room.skillHand,
          playerId,
        );
      }
      if (room.engine.street !== prevStreet && !room.engine.handOver) {
        onStreetChanged(room.skillHand);
        applyCowRuminate(
          room.engine,
          this.skillPlayerRefs(room),
          room.skillHand,
        );
      }
    }

    this.afterEngineAction(room);
  }

  useSkill(
    code: string,
    playerId: string,
    secret: string,
    payload: {
      targetPlayerId?: string;
      communityIndex?: number;
      raiseTo?: number;
    },
  ) {
    const room = this.requireRoom(code);
    if (room.ruleMode !== "skill") throw new Error("当前房间不是技能模式");
    const player = room.players.get(playerId);
    if (!player || player.secret !== secret) throw new Error("无权操作");
    if (!room.engine || room.status !== "playing" || !room.skillHand) {
      throw new Error("对局未开始");
    }
    if (player.away) throw new Error("离线中无法发动技能");

    const canAct =
      !room.engine.handOver &&
      room.engine.toPublic().actingPlayerId === playerId;

    // Sync room chips into engine before skill that mutates chips maps
    this.syncEngineChips(room);
    for (const p of room.players.values()) {
      const seat = room.engine.getPlayer(p.id);
      if (seat) seat.chips = p.chips;
    }

    const prevStreet = room.engine.street;
    const result = useActiveSkill({
      player: this.toSkillRef(player),
      players: this.skillPlayerRefs(room),
      engine: room.engine,
      hand: room.skillHand,
      canAct,
      payload,
    });

    // Write chip mutations from skill refs / engine back
    this.syncEngineChips(room);

    if (
      room.engine.street !== prevStreet &&
      !room.engine.handOver &&
      room.skillHand
    ) {
      onStreetChanged(room.skillHand);
      applyCowRuminate(
        room.engine,
        this.skillPlayerRefs(room),
        room.skillHand,
      );
      this.syncEngineChips(room);
    }

    if (!result.endsTurn) {
      this.publish(room.code);
      return;
    }
    this.afterEngineAction(room);
  }

  private toSkillRef(p: RoomPlayer): SkillPlayerRef {
    if (!p.avatarId) throw new Error("内部错误：缺少动物头像");
    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      chips: p.chips,
    };
  }

  private skillPlayerRefs(room: Room): SkillPlayerRef[] {
    return [...room.players.values()].map((p) => this.toSkillRef(p));
  }

  private afterEngineAction(room: Room) {
    if (!room.engine) return;

    if (
      room.ruleMode === "skill" &&
      room.skillHand &&
      room.engine.handOver
    ) {
      const invested = snapshotInvestments(room.engine);
      settleHandSkills({
        engine: room.engine,
        players: this.skillPlayerRefs(room),
        hand: room.skillHand,
      });
      const won = new Map<string, number>();
      for (const w of room.engine.winners ?? []) {
        won.set(w.playerId, (won.get(w.playerId) ?? 0) + w.amount);
      }
      applyHamsterAndLionWithSnapshot({
        engine: room.engine,
        players: this.skillPlayerRefs(room),
        hand: room.skillHand,
        invested,
        won,
      });
    }

    this.syncEngineChips(room);

    if (room.engine.handOver) {
      if (room.aiActionTimer) {
        clearTimeout(room.aiActionTimer);
        room.aiActionTimer = undefined;
      }
      const willContinue =
        [...room.players.values()].filter((p) => p.chips > 0).length >= 2;
      if (willContinue) {
        room.nextHandAt = Date.now() + BETWEEN_HANDS_MS;
      }
      this.publish(room.code);
      room.handPauseTimer = setTimeout(() => {
        room.nextHandAt = undefined;
        this.beginHand(room);
      }, BETWEEN_HANDS_MS);
      return;
    }

    this.publish(room.code);
    this.maybeScheduleAi(room);
  }

  private syncEngineChips(room: Room) {
    if (!room.engine) return;
    const chipById = new Map<string, number>();
    room.engine.syncChipsOut(chipById);
    for (const [id, chips] of chipById) {
      const p = room.players.get(id);
      if (p) p.chips = chips;
    }
    const awayById = new Map(
      [...room.players.values()].map((p) => [p.id, p.away || p.isBot] as const),
    );
    room.engine.syncAwayFlags(awayById);
  }

  private ensureTurnWatcher(room: Room) {
    if (room.turnWatchTimer) return;
    room.turnWatchTimer = setInterval(() => {
      if (!room.engine || room.engine.handOver) return;
      const endsAt = room.engine.turnEndsAt;
      if (endsAt != null && Date.now() >= endsAt) {
        this.runAiForCurrentActor(room, true);
      } else {
        this.maybeScheduleAi(room);
      }
    }, 500);
  }

  private restoreTimers(room: Room) {
    if (!room.engine) return;
    if (room.engine.handOver) {
      if (
        room.nextHandAt &&
        room.nextHandAt > Date.now() &&
        !room.handPauseTimer
      ) {
        room.handPauseTimer = setTimeout(() => {
          room.handPauseTimer = undefined;
          room.nextHandAt = undefined;
          this.beginHand(room);
        }, room.nextHandAt - Date.now());
      }
      return;
    }
    this.ensureTurnWatcher(room);
    this.maybeScheduleAi(room);
  }

  private clearRuntimeTimers(room: Room) {
    if (room.turnWatchTimer) clearInterval(room.turnWatchTimer);
    if (room.handPauseTimer) clearTimeout(room.handPauseTimer);
    if (room.aiActionTimer) clearTimeout(room.aiActionTimer);
    room.turnWatchTimer = undefined;
    room.handPauseTimer = undefined;
    room.aiActionTimer = undefined;
  }

  private maybeScheduleAi(room: Room) {
    if (!room.engine || room.engine.handOver) return;
    const actingId = room.engine.toPublic().actingPlayerId;
    if (!actingId) return;
    const player = room.players.get(actingId);
    if (!player) return;
    if (!(player.away || player.isBot)) return;
    if (room.aiActionTimer) return;
    room.aiActionTimer = setTimeout(() => {
      room.aiActionTimer = undefined;
      this.runAiForCurrentActor(room, false);
    }, AI_THINK_MS);
  }

  private runAiForCurrentActor(room: Room, dueToTimeout: boolean) {
    if (!room.engine || room.engine.handOver) return;
    const actingId = room.engine.toPublic().actingPlayerId;
    if (!actingId) return;
    const player = room.players.get(actingId);
    if (!player) return;
    if (!dueToTimeout && !(player.away || player.isBot)) return;

    try {
      let decision = chooseAiAction(room.engine, actingId);
      if (
        room.ruleMode === "skill" &&
        isRaiseBlockedBySkills(
          room.skillHand,
          room.engine,
          actingId,
          decision.type,
        )
      ) {
        const seat = room.engine.getPlayer(actingId);
        const toCall = seat
          ? room.engine.currentBet - seat.betThisStreet
          : 0;
        decision =
          toCall > 0
            ? { type: toCall >= (seat?.chips ?? 0) ? "all-in" : "call" }
            : { type: "check" };
        if (
          isRaiseBlockedBySkills(
            room.skillHand,
            room.engine,
            actingId,
            decision.type,
          )
        ) {
          decision = toCall > 0 ? { type: "fold" } : { type: "check" };
        }
      }
      const prevStreet = room.engine.street;
      room.engine.applyAction(actingId, decision.type, decision.amount, {
        ai: true,
      });
      if (room.ruleMode === "skill" && room.skillHand) {
        if (decision.type === "check") onPlayerChecked(room.skillHand, actingId);
        if (decision.type === "fold") {
          const p = room.players.get(actingId);
          if (p) {
            applyRabbitOnFold(room.engine, this.toSkillRef(p), room.skillHand);
            applyLionDuelOnFold(
              room.engine,
              this.skillPlayerRefs(room),
              room.skillHand,
              actingId,
            );
          }
        }
        if (room.engine.street !== prevStreet && !room.engine.handOver) {
          onStreetChanged(room.skillHand);
          applyCowRuminate(
            room.engine,
            this.skillPlayerRefs(room),
            room.skillHand,
          );
        }
      }
      this.afterEngineAction(room);
    } catch (err) {
      try {
        const p = room.engine.getPlayer(actingId);
        if (!p) return;
        const toCall = room.engine.currentBet - p.betThisStreet;
        if (toCall > 0) {
          room.engine.applyAction(actingId, "fold", undefined, { ai: true });
        } else {
          room.engine.applyAction(actingId, "check", undefined, { ai: true });
        }
        this.afterEngineAction(room);
      } catch {
        // swallow
      }
    }
  }

  getPublicState(code: string, viewerId?: string): RoomPublicState | null {
    const rev = this.revisions.get(code.toUpperCase()) ?? 0;
    return this.buildPublicState(code, viewerId, rev);
  }

  private buildSharedFrame(room: Room) {
    const engine = room.engine;
    const enginePublic = engine?.toPublic() ?? null;
    const contenderCount = engine
      ? [...room.players.values()].filter((p) => {
          const seat = engine.getPlayer(p.id);
          return !!seat && !seat.folded;
        }).length
      : 0;

    const playerBases = [...room.players.values()]
      .sort((a, b) => a.seat - b.seat)
      .map((p) => {
        const seatState = engine?.getPlayer(p.id);
        return {
          roomPlayer: p,
          seatState,
          base: {
            id: p.id,
            name: p.name,
            avatarId: p.avatarId,
            seat: p.seat,
            chips: p.chips,
            connected: p.connected,
            away: p.away || p.isBot,
            aiControlled: p.away || p.isBot,
            isHost: p.isHost,
            folded: seatState?.folded,
            allIn: seatState?.allIn,
            betThisStreet: seatState?.betThisStreet,
            holeCardCount: seatState ? seatState.holeCards.length : 0,
          } satisfies Omit<PublicPlayer, "holeCards">,
        };
      });

    const game: TexasHoldemPublicState | null = enginePublic
      ? { ...enginePublic, nextHandAt: room.nextHandAt ?? null }
      : null;

    return {
      engine,
      enginePublic,
      contenderCount,
      playerBases,
      game,
      meta: {
        code: room.code,
        status: room.status,
        gameType: room.gameType,
        ruleMode: room.ruleMode,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers,
      },
    };
  }

  private buildPublicState(
    code: string,
    viewerId: string | undefined,
    rev: number,
  ): RoomPublicState | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    return this.buildPublicStateFromFrame(
      room,
      this.buildSharedFrame(room),
      viewerId,
      rev,
    );
  }

  private buildPublicStateFromFrame(
    room: Room,
    frame: ReturnType<RoomManager["buildSharedFrame"]>,
    viewerId: string | undefined,
    rev: number,
  ): RoomPublicState {
    const viewerIsSpectator = !!viewerId && room.spectators.has(viewerId);

    const players: PublicPlayer[] = frame.playerBases.map(({ base, seatState, roomPlayer: p }) => {
      const isViewer = p.id === viewerId;
      const reveal = shouldRevealHoleCards({
        hasHoleCards: !!seatState && seatState.holeCards.length > 0,
        isViewer,
        isSpectator: viewerIsSpectator,
        street: frame.enginePublic?.street,
        folded: seatState?.folded,
        contenderCount: frame.contenderCount,
      });
      return {
        ...base,
        holeCards: reveal ? (seatState?.holeCards ?? null) : null,
      };
    });

    let you: RoomPublicState["you"] = null;
    if (viewerId) {
      const me = room.players.get(viewerId);
      const seatState = frame.engine?.getPlayer(viewerId);
      if (me) {
        const toCall = frame.engine
          ? Math.max(0, frame.engine.currentBet - (seatState?.betThisStreet ?? 0))
          : 0;
        const canAct =
          !!frame.engine &&
          !frame.engine.handOver &&
          frame.enginePublic?.actingPlayerId === viewerId &&
          !me.away &&
          !me.isBot;
        const minRaiseTo = frame.engine
          ? frame.engine.currentBet + frame.engine.minRaise
          : 0;
        you = {
          playerId: me.id,
          seat: me.seat,
          spectator: false,
          canAct,
          callAmount: Math.min(toCall, me.chips),
          minRaiseTo: Math.min(
            minRaiseTo,
            me.chips + (seatState?.betThisStreet ?? 0),
          ),
          maxRaiseTo: me.chips + (seatState?.betThisStreet ?? 0),
          skill:
            room.ruleMode === "skill" &&
            room.status === "playing" &&
            me.avatarId
              ? buildViewerSkillState({
                  ruleMode: room.ruleMode,
                  player: this.toSkillRef(me),
                  spectator: false,
                  canAct,
                  engine: frame.engine,
                  hand: room.skillHand,
                })
              : null,
        };
      } else if (room.spectators.has(viewerId)) {
        you = {
          playerId: viewerId,
          seat: -1,
          spectator: true,
          canAct: false,
          callAmount: 0,
          minRaiseTo: 0,
          maxRaiseTo: 0,
          skill: null,
        };
      }
    }

    return {
      ...frame.meta,
      rev,
      players,
      you,
      game: frame.game,
    };
  }

  listViewerIds(code: string): string[] {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return [];
    return [
      ...[...room.players.values()]
      .filter((p) => p.socketId)
      .map((p) => p.id),
      ...[...room.spectators.keys()].filter((id) => room.spectatorSockets.has(id)),
    ];
  }

  getSocketId(code: string, playerId: string): string | undefined {
    const room = this.rooms.get(code.toUpperCase());
    return room?.players.get(playerId)?.socketId ?? room?.spectatorSockets.get(playerId);
  }

  private requireRoom(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error("房间不存在");
    return room;
  }

  private destroyRoom(room: Room) {
    if (room.turnWatchTimer) clearInterval(room.turnWatchTimer);
    if (room.handPauseTimer) clearTimeout(room.handPauseTimer);
    if (room.aiActionTimer) clearTimeout(room.aiActionTimer);
    for (const p of room.players.values()) {
      if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
    }
    if (this.persistenceEnabled) {
      const previous = this.writeQueues.get(room.code) ?? Promise.resolve();
      const deletion = previous
        .catch(() => undefined)
        .then(() => this.repository.delete(room.code));
      this.writeQueues.set(room.code, deletion);
      this.pendingWrites.add(deletion);
      void deletion
        .finally(() => {
          this.pendingWrites.delete(deletion);
          if (this.writeQueues.get(room.code) === deletion) {
            this.writeQueues.delete(room.code);
          }
        })
        .catch(() => undefined);
    }
    this.revisions.delete(room.code);
    this.snapshots.delete(room.code);
    this.rooms.delete(room.code);
  }
}
