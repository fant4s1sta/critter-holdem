import { io } from "socket.io-client";
import { mergeRoomPatch } from "../src/lib/room-state-sync";
import type { RoomPatch, RoomPublicState } from "../src/lib/types";

const URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function onceAck<T>(
  socket: ReturnType<typeof io>,
  event: string,
  payload: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${event}`)), 8000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(t);
      resolve(res);
    });
  });
}

async function main() {
  const host = io(URL, { transports: ["websocket"] });
  await new Promise<void>((resolve, reject) => {
    host.on("connect", () => resolve());
    host.on("connect_error", reject);
  });

  const created = await onceAck<{
    ok: boolean;
    identity?: { playerId: string; secret: string; name: string };
    room?: { code: string; players: unknown[] };
    error?: string;
  }>(host, "create_room", { name: "Host", gameType: "texas-holdem" });
  if (!created.ok || !created.identity || !created.room) {
    throw new Error(created.error || "create failed");
  }
  const code = created.room.code;
  console.log("created", code);

  const guest = io(URL, { transports: ["websocket"] });
  await new Promise<void>((r) => guest.on("connect", () => r()));
  const joined = await onceAck<{
    ok: boolean;
    identity?: { playerId: string; secret: string };
    error?: string;
  }>(guest, "join_room", { code, name: "Guest" });
  if (!joined.ok || !joined.identity) throw new Error(joined.error || "join failed");
  console.log("joined");

  // disconnect guest -> should become away after grace
  guest.disconnect();
  await new Promise((r) => setTimeout(r, 3200));

  const started = await onceAck<{ ok: boolean; error?: string }>(host, "start_game", {
    code,
    playerId: created.identity.playerId,
    secret: created.identity.secret,
  });
  if (!started.ok) throw new Error(started.error || "start failed");
  console.log("started");

  // wait for some AI / host actions via room_state / room_patch
  let sawAi = false;
  let hands = 0;
  let roomState: RoomPublicState | null = null;
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("game progress timeout")), 25000);
    const check = () => {
      if (!roomState) return;
      if (roomState.players.some((p) => p.name === "Guest" && p.away)) {
        // guest away expected
      }
      if (roomState.game?.lastAction?.ai) sawAi = true;
      if (roomState.game?.handNumber) {
        hands = Math.max(hands, roomState.game.handNumber);
      }
      if (sawAi && hands >= 1 && roomState.game?.street) {
        clearTimeout(t);
        resolve();
      }
    };
    host.on("room_state", (state: RoomPublicState) => {
      roomState = state;
      check();
    });
    host.on("room_patch", (patch: RoomPatch) => {
      if (!roomState) return;
      roomState = mergeRoomPatch(roomState, patch);
      check();
    });
  });

  // reconnect guest
  const guest2 = io(URL, { transports: ["websocket"] });
  await new Promise<void>((r) => guest2.on("connect", () => r()));
  const re = await onceAck<{ ok: boolean; room?: { players: { id: string; away: boolean }[] }; error?: string }>(
    guest2,
    "reconnect_room",
    {
      code,
      playerId: joined.identity.playerId,
      secret: joined.identity.secret,
    },
  );
  if (!re.ok || !re.room) throw new Error(re.error || "reconnect failed");
  const me = re.room.players.find((p) => p.id === joined.identity!.playerId);
  if (!me || me.away) throw new Error("guest still away after reconnect");
  console.log("reconnected ok; aiSeen=", sawAi, "hand=", hands);
  host.close();
  guest2.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
