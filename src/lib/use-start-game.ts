"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";
import type { PlayerIdentity, RoomPublicState } from "./types";

const START_TIMEOUT_MS = 8_000;

/** Host "开始对局" with an immediate pending state so a slow ack can't double-fire. */
export function useStartGame(opts: {
  roomCode: string;
  identity: PlayerIdentity | null;
  room: RoomPublicState | null;
  onError: (message: string) => void;
}) {
  const { roomCode, identity, room, onError } = opts;
  const [starting, setStarting] = useState(false);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const settle = useCallback(() => {
    requestIdRef.current += 1;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStarting(false);
  }, []);

  useEffect(() => settle, [settle]);

  // The room leaving the lobby is the real success signal.
  useEffect(() => {
    if (starting && room && room.status !== "lobby") settle();
  }, [room, starting, settle]);

  const startGame = useCallback(() => {
    if (!identity || !room || starting) return;
    if (room.status !== "lobby" || room.players.length < 2) return;

    const requestId = ++requestIdRef.current;
    setStarting(true);
    timeoutRef.current = window.setTimeout(() => {
      if (requestId !== requestIdRef.current) return;
      timeoutRef.current = null;
      setStarting(false);
      onError("开始对局超时，请重试");
    }, START_TIMEOUT_MS);

    getSocket().emit(
      "start_game",
      {
        code: roomCode,
        playerId: identity.playerId,
        secret: identity.secret,
      },
      (res: { ok: boolean; error?: string }) => {
        if (requestId !== requestIdRef.current) return;
        if (res.ok) return; // status flip clears the pending state
        settle();
        onError(res.error || "无法开始");
      },
    );
  }, [identity, onError, room, roomCode, settle, starting]);

  const canStart = Boolean(
    room && !starting && room.status === "lobby" && room.players.length >= 2,
  );

  return { startGame, starting, canStart };
}
