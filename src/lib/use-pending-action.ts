"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PENDING_ACTION_TIMEOUT_MS,
  canSubmitAction,
  createPendingAction,
  pendingActionResolved,
  type PendingAction,
} from "./pending-action";
import { getSocket } from "./socket";
import type { GameActionPayload, PlayerIdentity, RoomPublicState } from "./types";

/**
 * Optimistic lock for bet / fold buttons. Locks the panel the instant the
 * player taps, so a slow round-trip never reads as "did that register?" and
 * a double tap can't send a second action the server would reject.
 */
export function usePendingAction(opts: {
  roomCode: string;
  identity: PlayerIdentity | null;
  room: RoomPublicState | null;
  onError: (message: string) => void;
}) {
  const { roomCode, identity, room, onError } = opts;
  const [pending, setPending] = useState<PendingAction | null>(null);
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    requestIdRef.current += 1;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPending(null);
  }, []);

  useEffect(() => clearPending, [clearPending]);

  // Unlock as soon as the table reflects the action (or moves on without it).
  useEffect(() => {
    if (pending && pendingActionResolved(pending, room)) clearPending();
  }, [pending, room, clearPending]);

  const emitAction = useCallback(
    (action: GameActionPayload) => {
      if (!identity || !room) return;
      if (!canSubmitAction(room, pending)) return;

      const socket = getSocket();
      if (!socket.connected) {
        onError("网络连接中断，正在重连…");
        return;
      }

      const requestId = ++requestIdRef.current;
      setPending(createPendingAction(room, action));
      timeoutRef.current = window.setTimeout(() => {
        if (requestId !== requestIdRef.current) return;
        timeoutRef.current = null;
        setPending(null);
      }, PENDING_ACTION_TIMEOUT_MS);

      socket.emit(
        "game_action",
        {
          code: roomCode,
          playerId: identity.playerId,
          secret: identity.secret,
          action,
        },
        (res: { ok: boolean; error?: string }) => {
          if (requestId !== requestIdRef.current) return;
          if (res.ok) return; // room patch (already sent) clears the lock
          clearPending();
          onError(res.error || "操作失败");
        },
      );
    },
    [clearPending, identity, onError, pending, room, roomCode],
  );

  return {
    emitAction,
    pendingAction: pending,
    actionLocked: !canSubmitAction(room, pending),
  };
}
