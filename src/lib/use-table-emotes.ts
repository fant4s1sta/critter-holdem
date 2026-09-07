"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMOTE_COOLDOWN_MS,
  EMOTE_DISPLAY_MS,
  isEmoteId,
  type EmoteId,
  type PlayerEmoteEvent,
} from "@/lib/emotes";
import { getSocket } from "@/lib/socket";
import type { PlayerIdentity } from "@/lib/types";

export type SeatEmoteBubble = {
  playerId: string;
  emoteId: EmoteId;
  at: number;
};

/**
 * Side-channel table emotes — listens/broadcasts outside room_state revision sync.
 */
export function useTableEmotes(opts: {
  enabled: boolean;
  roomCode: string;
  identity: PlayerIdentity | null;
  onError?: (message: string) => void;
}) {
  const { enabled, roomCode, identity, onError } = opts;
  const [bubbles, setBubbles] = useState<Record<string, SeatEmoteBubble>>({});
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [coolingDown, setCoolingDown] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    const code = roomCode.toUpperCase();

    const onPlayerEmote = (event: PlayerEmoteEvent) => {
      if (event.code !== code) return;
      if (!isEmoteId(event.emoteId)) return;

      setBubbles((prev) => ({
        ...prev,
        [event.playerId]: {
          playerId: event.playerId,
          emoteId: event.emoteId,
          at: event.at,
        },
      }));

      const existing = timersRef.current.get(event.playerId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setBubbles((prev) => {
          const current = prev[event.playerId];
          if (!current || current.at !== event.at) return prev;
          const next = { ...prev };
          delete next[event.playerId];
          return next;
        });
        timersRef.current.delete(event.playerId);
      }, EMOTE_DISPLAY_MS);
      timersRef.current.set(event.playerId, timer);
    };

    socket.on("player_emote", onPlayerEmote);
    return () => {
      socket.off("player_emote", onPlayerEmote);
      // Do not clear bubbles here — StrictMode/effect refresh would wipe
      // an in-flight optimistic bubble before paint.
    };
  }, [enabled, roomCode]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const showBubble = useCallback((playerId: string, emoteId: EmoteId, at: number) => {
    setBubbles((prev) => ({
      ...prev,
      [playerId]: { playerId, emoteId, at },
    }));
    const existing = timersRef.current.get(playerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setBubbles((prev) => {
        const current = prev[playerId];
        if (!current || current.at !== at) return prev;
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      timersRef.current.delete(playerId);
    }, EMOTE_DISPLAY_MS);
    timersRef.current.set(playerId, timer);
  }, []);

  const sendEmote = useCallback(
    (emoteId: EmoteId) => {
      if (!identity) return;
      if (Date.now() < cooldownUntil) return;
      if (!isEmoteId(emoteId)) return;

      // Show immediately for the sender (do not wait for ack / broadcast).
      const at = Date.now();
      showBubble(identity.playerId, emoteId, at);

      const socket = getSocket();
      socket.emit(
        "send_emote",
        {
          code: roomCode.toUpperCase(),
          playerId: identity.playerId,
          secret: identity.secret,
          emoteId,
        },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok) {
            onError?.(res.error || "发送失败");
            return;
          }
          const until = Date.now() + EMOTE_COOLDOWN_MS;
          setCooldownUntil(until);
          setCoolingDown(true);
          if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
          cooldownTimerRef.current = setTimeout(() => {
            setCoolingDown(false);
            cooldownTimerRef.current = null;
          }, EMOTE_COOLDOWN_MS);
        },
      );
    },
    [cooldownUntil, identity, onError, roomCode, showBubble],
  );

  return {
    bubbles,
    sendEmote,
    cooldownUntil,
    coolingDown,
  };
}
