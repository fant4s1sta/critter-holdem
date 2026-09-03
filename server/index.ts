import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import type {
  GameActionPayload,
  AnimalId,
  GameTypeId,
  PublicPlayer,
  RoomPublicState,
  RuleMode,
} from "../src/lib/types";
import { RoomManager } from "./room-manager";

const dev = process.env.NODE_ENV !== "production";
// Local dev binds loopback only. Railway HOSTNAME is a container name, not a
// bind address — production must listen on all interfaces.
const hostname = dev ? "127.0.0.1" : "0.0.0.0";
const port = Number(process.env.PORT || (dev ? 3000 : 80));

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

type ClientToServer = {
  create_room: (
    payload: {
      name: string;
      gameType?: GameTypeId;
      ruleMode?: RuleMode;
      mode?: "multi" | "single";
      aiCount?: number;
    },
    ack: (res: { ok: true; identity: unknown; room: RoomPublicState } | { ok: false; error: string }) => void,
  ) => void;
  join_room: (
    payload: { code: string; name: string },
    ack: (res: { ok: true; identity: unknown; room: RoomPublicState } | { ok: false; error: string }) => void,
  ) => void;
  reconnect_room: (
    payload: { code: string; playerId: string; secret: string },
    ack: (res: { ok: true; room: RoomPublicState } | { ok: false; error: string }) => void,
  ) => void;
  check_room: (
    payload: { code: string; playerId: string; secret: string },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  bind_room: (
    payload: { code: string; playerId: string; secret: string },
    ack: (res: { ok: true; room: RoomPublicState } | { ok: false; error: string }) => void,
  ) => void;
  leave_room: (
    payload: { code: string; playerId: string; secret: string },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  add_bot: (
    payload: { code: string; playerId: string; secret: string },
    ack: (res: { ok: boolean; error?: string; player?: PublicPlayer }) => void,
  ) => void;
  set_avatar: (
    payload: { code: string; playerId: string; secret: string; avatarId: AnimalId },
    ack: (
      res:
        | { ok: true; identity: unknown; room: RoomPublicState }
        | { ok: false; error: string },
    ) => void,
  ) => void;
  start_game: (
    payload: { code: string; playerId: string; secret: string },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  game_action: (
    payload: {
      code: string;
      playerId: string;
      secret: string;
      action: GameActionPayload;
    },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  use_skill: (
    payload: {
      code: string;
      playerId: string;
      secret: string;
      targetPlayerId?: string;
      communityIndex?: number;
      raiseTo?: number;
    },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void;
};

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    if (req.url === "/healthz" || req.url === "/health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          ok: true,
          service: "critter-holdem",
          env: dev ? "development" : "production",
        }),
      );
      return;
    }
    handle(req, res);
  });

  const io = new Server(server, {
    cors: { origin: true, credentials: true },
    pingInterval: 10_000,
    pingTimeout: 20_000,
    transports: ["websocket", "polling"],
    allowUpgrades: true,
    perMessageDeflate: {
      threshold: 512,
    },
  });

  const rooms = new RoomManager({
    emitRoom: (code, options) => {
      broadcastRoom(code, options?.forceFull ?? false);
    },
  });

  function broadcastRoom(code: string, forceFull: boolean) {
    for (const emission of rooms.collectEmissions(code, { forceFull })) {
      if (emission.type === "full") {
        io.to(emission.socketId).emit("room_state", emission.state);
      } else {
        io.to(emission.socketId).emit("room_patch", emission.patch);
      }
    }
  }

  io.on("connection", (socket) => {
    const c2s = socket as typeof socket & {
      on: <K extends keyof ClientToServer>(
        event: K,
        handler: ClientToServer[K],
      ) => void;
    };

    c2s.on("create_room", async (payload, ack) => {
      try {
        const result = rooms.createRoom(payload);
        await rooms.flushPersistence();
        socket.join(`room:${result.room.code}`);
        rooms.bindSocket(result.room.code, result.identity.playerId, socket.id);
        await rooms.flushPersistence();
        ack({ ok: true, identity: result.identity, room: result.room });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "创建失败" });
      }
    });

    c2s.on("join_room", (payload, ack) => {
      void (async () => {
       try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        const result = rooms.joinRoom(payload);
        await rooms.flushPersistence();
        socket.join(`room:${result.room.code}`);
        if (result.spectator) {
          rooms.bindSpectator(result.room.code, result.identity.playerId, socket.id);
        } else {
          rooms.bindSocket(result.room.code, result.identity.playerId, socket.id);
        }
        await rooms.flushPersistence();
        ack({
          ok: true,
          identity: result.identity,
          room: rooms.getPublicState(result.room.code, result.identity.playerId)!,
        });
       } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "加入失败" });
       }
      })();
    });

    c2s.on("check_room", async (payload, ack) => {
      await rooms.hydrate(payload.code);
      const ok = rooms.canResume(payload.code, payload.playerId, payload.secret);
      ack(
        ok
          ? { ok: true }
          : { ok: false, error: "房间不存在或已解散" },
      );
    });

    c2s.on("reconnect_room", (payload, ack) => {
      void (async () => {
       try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在或已解散");
        }
        socket.join(`room:${payload.code.toUpperCase()}`);
        const room = rooms.reconnect({ ...payload, socketId: socket.id });
        await rooms.flushPersistence();
        ack({ ok: true, room });
       } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "重连失败" });
       }
      })();
    });

    c2s.on("bind_room", (payload, ack) => {
      void (async () => {
       try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在或已解散");
        }
        const room = rooms.reconnect({ ...payload, socketId: socket.id });
        await rooms.flushPersistence();
        socket.join(`room:${payload.code.toUpperCase()}`);
        ack({ ok: true, room });
       } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "绑定失败" });
       }
      })();
    });

    c2s.on("leave_room", async (payload, ack) => {
      try {
        await rooms.hydrate(payload.code);
        rooms.leaveRoom(payload.code, payload.playerId, payload.secret);
        await rooms.flushPersistence();
        socket.leave(`room:${payload.code.toUpperCase()}`);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: e instanceof Error ? e.message : "离开失败" });
      }
    });

    c2s.on("add_bot", async (payload, ack) => {
      try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        const player = rooms.addBot(payload.code, payload.playerId, payload.secret);
        ack({ ok: true, player });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "添加失败" });
      }
    });

    c2s.on("set_avatar", async (payload, ack) => {
      try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        const identity = rooms.setAvatar(
          payload.code,
          payload.playerId,
          payload.secret,
          payload.avatarId,
        );
        ack({
          ok: true,
          identity,
          room: rooms.getPublicState(payload.code, payload.playerId)!,
        });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "选择失败" });
      }
    });

    c2s.on("start_game", async (payload, ack) => {
      try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        rooms.startGame(payload.code, payload.playerId, payload.secret);
        ack({ ok: true });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "开始失败" });
      }
    });

    c2s.on("game_action", async (payload, ack) => {
      try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        rooms.applyAction(
          payload.code,
          payload.playerId,
          payload.secret,
          payload.action,
        );
        ack({ ok: true });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "操作失败" });
      }
    });

    c2s.on("use_skill", async (payload, ack) => {
      try {
        if (!(await rooms.hydrate(payload.code))) {
          throw new Error("房间不存在");
        }
        rooms.useSkill(payload.code, payload.playerId, payload.secret, {
          targetPlayerId: payload.targetPlayerId,
          communityIndex: payload.communityIndex,
          raiseTo: payload.raiseTo,
        });
        ack({ ok: true });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : "技能失败" });
      }
    });

    socket.on("disconnect", () => {
      rooms.handleDisconnect(socket.id);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Critter Hold'em ready on http://${hostname}:${port}`);
  });
});
