"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlayerIdentity, RoomPublicState } from "./types";
import { getSocket } from "./socket";

export function useAddBot(opts: {
  roomCode: string;
  identity: PlayerIdentity | null;
  room: RoomPublicState | null;
  setError: (message: string) => void;
}) {
  const { roomCode, identity, room, setError } = opts;
  const [addingBot, setAddingBot] = useState(false);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    },
    [],
  );

  const seatedPlayerCount = room?.players.length ?? 0;
  const canAddBot = Boolean(
    room && !addingBot && seatedPlayerCount < room.maxPlayers,
  );

  const addBot = useCallback(() => {
    if (!identity || !room || addingBot) return;
    if (room.players.length >= room.maxPlayers) return;

    const requestId = ++requestIdRef.current;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setAddingBot(true);
    timeoutRef.current = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      timeoutRef.current = null;
      setAddingBot(false);
      setError("添加 AI 请求超时，请检查网络后重试");
    }, 8_000);
    getSocket().emit(
      "add_bot",
      {
        code: roomCode,
        playerId: identity.playerId,
        secret: identity.secret,
      },
      (res: { ok: boolean; error?: string }) => {
        if (requestId !== requestIdRef.current) return;
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setAddingBot(false);
        if (!res.ok) setError(res.error || "无法添加 AI");
      },
    );
  }, [addingBot, identity, room, roomCode, setError]);

  return { addBot, addingBot, seatedPlayerCount, canAddBot };
}
