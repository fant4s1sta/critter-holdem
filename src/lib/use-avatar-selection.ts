"use client";

import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { AnimalId, PlayerIdentity, RoomPublicState, RuleMode } from "./types";
import { saveRoomSession } from "./session";
import { getSocket } from "./socket";

type SetAvatarAck = {
  ok: boolean;
  error?: string;
  identity?: PlayerIdentity;
  room?: RoomPublicState;
};

export function useAvatarSelection(opts: {
  roomCode: string;
  identity: PlayerIdentity | null;
  setIdentity: Dispatch<SetStateAction<PlayerIdentity | null>>;
  setRoom: Dispatch<SetStateAction<RoomPublicState | null>>;
  setError: (message: string) => void;
  ruleMode?: RuleMode;
}) {
  const { roomCode, identity, setIdentity, setRoom, setError, ruleMode } = opts;
  const inflightAvatarRef = useRef<AnimalId | null>(null);
  const avatarReqRef = useRef(0);

  const applyAvatarOverlay = useCallback(
    (state: RoomPublicState): RoomPublicState => {
      const desired = inflightAvatarRef.current;
      const playerId = identity?.playerId;
      if (!desired || !playerId) return state;

      const me = state.players.find((p) => p.id === playerId);
      if (me?.avatarId === desired) return state;

      return {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? { ...p, avatarId: desired } : p,
        ),
      };
    },
    [identity?.playerId],
  );

  const syncIdentityAvatar = useCallback(
    (state: RoomPublicState) => {
      setIdentity((prev) => {
        if (!prev) return prev;
        const me = state.players.find((p) => p.id === prev.playerId);
        if (!me || me.avatarId === prev.avatarId) return prev;
        const next = { ...prev, avatarId: me.avatarId };
        saveRoomSession(roomCode, next, state.ruleMode);
        return next;
      });
    },
    [roomCode, setIdentity],
  );

  const setAvatar = useCallback(
    (avatarId: AnimalId) => {
      if (!identity) return;

      const reqId = ++avatarReqRef.current;
      inflightAvatarRef.current = avatarId;

      setIdentity((prev) => {
        if (!prev) return prev;
        const next = { ...prev, avatarId };
        saveRoomSession(roomCode, next, ruleMode);
        return next;
      });

      setRoom((prev) => {
        if (!prev) return prev;
        return applyAvatarOverlay({
          ...prev,
          players: prev.players.map((p) =>
            p.id === identity.playerId ? { ...p, avatarId } : p,
          ),
        });
      });

      getSocket().emit(
        "set_avatar",
        {
          code: roomCode,
          playerId: identity.playerId,
          secret: identity.secret,
          avatarId,
        },
        (res: SetAvatarAck) => {
          if (reqId !== avatarReqRef.current) return;

          if (!res.ok) {
            inflightAvatarRef.current = null;
            setError(res.error || "无法选择动物");
            if (res.room) {
              const nextState = res.room;
              setRoom(nextState);
              syncIdentityAvatar(nextState);
            }
            return;
          }

          const me = res.room?.players.find((p) => p.id === identity.playerId);
          if (me?.avatarId === avatarId) {
            inflightAvatarRef.current = null;
          }
        },
      );
    },
    [
      applyAvatarOverlay,
      identity,
      roomCode,
      ruleMode,
      setError,
      setIdentity,
      setRoom,
      syncIdentityAvatar,
    ],
  );

  return { setAvatar, applyAvatarOverlay };
}
