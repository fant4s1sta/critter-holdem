"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { mergeRoomPatch } from "@/lib/room-state-sync";
import type { PlayerIdentity, RoomPatch, RoomPublicState } from "@/lib/types";

type ReconnectAck = {
  ok: boolean;
  room?: RoomPublicState;
  error?: string;
};

export function isStaleRoomError(message?: string) {
  return !!message && /不存在|已解散|身份校验失败/.test(message);
}

/**
 * Single owner of room socket bind/reconnect for a seated player.
 * Also forces reconnect when the mobile tab returns to the foreground.
 */
export function useRoomConnection(opts: {
  enabled: boolean;
  roomCode: string;
  identity: PlayerIdentity | null;
  /** Room snapshot from create/join ack — skips empty UI while reconnecting. */
  initialRoom?: RoomPublicState | null;
  onState: (state: RoomPublicState) => void;
  onError?: (message: string) => void;
  onStaleRoom?: () => void;
}) {
  const { enabled, roomCode, identity, initialRoom, onState, onError, onStaleRoom } =
    opts;
  const lastRevRef = useRef(0);
  const roomRef = useRef<RoomPublicState | null>(null);

  useEffect(() => {
    if (!enabled || !identity) return;

    const socket = getSocket();
    const code = roomCode.toUpperCase();

    if (initialRoom?.code.toUpperCase() === code) {
      lastRevRef.current = initialRoom.rev ?? 0;
      roomRef.current = initialRoom;
    }

    const applyFull = (state: RoomPublicState) => {
      lastRevRef.current = state.rev ?? 0;
      roomRef.current = state;
      onState(state);
    };

    const bindRoom = () => {
      if (!socket.connected) {
        socket.connect();
        return;
      }
      socket.emit(
        "reconnect_room",
        {
          code,
          playerId: identity.playerId,
          secret: identity.secret,
        },
        (res: ReconnectAck) => {
          if (!res.ok || !res.room) {
            const message = res.error || "无法重连到房间";
            if (isStaleRoomError(message)) {
              onStaleRoom?.();
              return;
            }
            onError?.(message);
            return;
          }
          onError?.("");
          applyFull(res.room);
        },
      );
    };

    const onRoomState = (state: RoomPublicState) => {
      if (state.code !== code) return;
      applyFull(state);
    };

    const onRoomPatch = (patch: RoomPatch) => {
      if (patch.code !== code) return;

      const lastRev = lastRevRef.current;
      if (patch.rev <= lastRev) return;

      if (patch.rev > lastRev + 1 || !roomRef.current) {
        bindRoom();
        return;
      }

      const merged = mergeRoomPatch(roomRef.current, patch);
      lastRevRef.current = patch.rev;
      roomRef.current = merged;
      onState(merged);
    };

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      bindRoom();
    };

    socket.on("room_state", onRoomState);
    socket.on("room_patch", onRoomPatch);
    socket.on("connect", bindRoom);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);

    bindRoom();

    return () => {
      socket.off("room_state", onRoomState);
      socket.off("room_patch", onRoomPatch);
      socket.off("connect", bindRoom);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
      lastRevRef.current = 0;
      roomRef.current = null;
    };
  }, [enabled, identity, initialRoom, onError, onStaleRoom, onState, roomCode]);
}
