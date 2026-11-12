import { useEffect, useRef, useState } from "react";
import { readSession, saveSession, type Session } from "@/lib/session";
import { RoomError, RoomSocket } from "@/lib/socket";
import { readRoomCodeFromLocation, replaceRoomUrl } from "@/lib/spa-route";
import type { RoomPublicState } from "@/lib/types";
import { HomeLobby } from "./HomeLobby";
import { Room3DClient } from "./Room3DClient";

function initialSession() {
  const session = readSession();
  const invite = readRoomCodeFromLocation();
  return invite && session?.code !== invite ? null : session;
}

export function AppShell() {
  const [session, setSession] = useState(initialSession);
  const active = useRef(session);
  const transport = useRef<RoomSocket | null>(null);
  const [snapshot, setSnapshot] = useState<{ room: RoomPublicState; receivedAt: number } | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState("");
  const [invite, setInvite] = useState(readRoomCodeFromLocation);

  function changeSession(next: Session | null, persist = true) {
    active.current = next;
    if (persist) saveSession(next);
    setSession(next);
    setInvite(null);
    replaceRoomUrl(next?.code ?? null);
    if (!next) setSnapshot(null);
  }

  useEffect(() => {
    let retry: number | undefined;
    let delay = 500;
    let disposed = false;
    const socket = new RoomSocket({
      open() {
        const previous = active.current;
        if (!previous) {
          delay = 500;
          setConnected(true);
          return;
        }
        void socket.request({ type: "resume", ...previous }).then(() => {
          if (disposed) return;
          replaceRoomUrl(previous.code);
          delay = 500;
          setConnected(true);
        }).catch((error: unknown) => {
          if (disposed) return;
          if (error instanceof RoomError && (error.code === "missing_room" || error.code === "invalid_session")) {
            changeSession(null);
            setNotice(error.message);
            setConnected(true);
          }
        });
      },
      close() {
        setConnected(false);
        retry = window.setTimeout(() => socket.connect(), delay);
        delay = Math.min(delay * 2, 5000);
      },
      state(room) {
        setSnapshot({ room, receivedAt: Date.now() });
      },
      ended(error) {
        setConnected(false);
        changeSession(null, false);
        setNotice(error);
      },
    });
    transport.current = socket;
    socket.connect();
    return () => {
      disposed = true;
      window.clearTimeout(retry);
      socket.close();
      transport.current = null;
    };
  }, []);

  async function request(command: Parameters<RoomSocket["request"]>[0]) {
    if (!transport.current) throw new RoomError("连接中，请稍后重试");
    return transport.current.request(command);
  }

  async function enter(mode: "create" | "join", name: string, code: string) {
    setNotice("");
    const response = await request(mode === "create" ? { type: "create", name } : { type: "join", name, code });
    if (!response.code || !response.identity) throw new RoomError("服务器未返回房间身份");
    changeSession({ code: response.code, ...response.identity });
  }

  if (!session) {
    return <HomeLobby key={invite} connected={connected} initialJoinCode={invite} notice={notice} enter={enter} />;
  }

  const current = snapshot?.room.code === session.code && snapshot.room.you.playerId === session.playerId
    ? snapshot : null;
  return <Room3DClient
    key={session.code}
    code={session.code}
    room={current?.room ?? null}
    receivedAt={current?.receivedAt}
    connected={connected}
    request={request}
    onLeave={() => changeSession(null)}
  />;
}
