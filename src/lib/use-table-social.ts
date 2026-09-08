"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  EMOTE_COOLDOWN_MS,
  EMOTE_DISPLAY_MS,
  isEmoteId,
  type EmoteId,
  type PlayerEmoteEvent,
} from "@/lib/emotes";
import {
  ITEM_FLIGHT_MS,
  ITEM_HIT_MS,
  isTableItemId,
  type PlayerItemEvent,
  type SeatItemFlight,
  type TableItemId,
} from "@/lib/table-items";
import { getSocket } from "@/lib/socket";
import { shouldIgnoreOwnSocialEcho } from "@/lib/social-echo";
import type { PlayerIdentity } from "@/lib/types";

export type SeatEmoteBubble = {
  playerId: string;
  emoteId: EmoteId;
  at: number;
};

export type SeatItemHit = {
  targetPlayerId: string;
  itemId: TableItemId;
  at: number;
};

export type { SeatItemFlight };

/**
 * Side-channel table emotes + items — outside room_state revision sync.
 * Emotes and items share one 2s cooldown.
 */
export function useTableSocial(opts: {
  enabled: boolean;
  roomCode: string;
  identity: PlayerIdentity | null;
  onError?: (message: string) => void;
}) {
  const { enabled, roomCode, identity, onError } = opts;
  const [bubbles, setBubbles] = useState<Record<string, SeatEmoteBubble>>({});
  const [hits, setHits] = useState<Record<string, SeatItemHit>>({});
  const [flights, setFlights] = useState<SeatItemFlight[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [coolingDown, setCoolingDown] = useState(false);
  const emoteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const itemTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const flightTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityRef = useRef(identity);
  identityRef.current = identity;

  const showHit = useCallback((targetPlayerId: string, itemId: TableItemId, at: number) => {
    setHits((prev) => ({
      ...prev,
      [targetPlayerId]: { targetPlayerId, itemId, at },
    }));
    const existing = itemTimersRef.current.get(targetPlayerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setHits((prev) => {
        const current = prev[targetPlayerId];
        if (!current || current.at !== at) return prev;
        const next = { ...prev };
        delete next[targetPlayerId];
        return next;
      });
      itemTimersRef.current.delete(targetPlayerId);
    }, ITEM_HIT_MS);
    itemTimersRef.current.set(targetPlayerId, timer);
  }, []);

  const showThrow = useCallback(
    (
      fromPlayerId: string,
      targetPlayerId: string,
      itemId: TableItemId,
      at: number,
    ) => {
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        showHit(targetPlayerId, itemId, at);
        return;
      }

      const key = `${fromPlayerId}:${targetPlayerId}:${at}`;
      setFlights((prev) => [
        ...prev.filter((flight) => `${flight.fromPlayerId}:${flight.targetPlayerId}:${flight.at}` !== key),
        { fromPlayerId, targetPlayerId, itemId, at },
      ]);
      const existing = flightTimersRef.current.get(key);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setFlights((prev) =>
          prev.filter(
            (flight) =>
              flight.at !== at ||
              flight.fromPlayerId !== fromPlayerId ||
              flight.targetPlayerId !== targetPlayerId,
          ),
        );
        flightTimersRef.current.delete(key);
        showHit(targetPlayerId, itemId, at);
      }, ITEM_FLIGHT_MS);
      flightTimersRef.current.set(key, timer);
    },
    [showHit],
  );

  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    const code = roomCode.toUpperCase();

    const onPlayerEmote = (event: PlayerEmoteEvent) => {
      if (event.code !== code) return;
      if (!isEmoteId(event.emoteId)) return;
      const me = identityRef.current;
      // Sender already painted an optimistic bubble; applying the room echo
      // would retarget `at` and restart the CSS pop (visible flicker).
      if (shouldIgnoreOwnSocialEcho(me?.playerId, event.playerId)) return;

      setBubbles((prev) => ({
        ...prev,
        [event.playerId]: {
          playerId: event.playerId,
          emoteId: event.emoteId,
          at: event.at,
        },
      }));

      const existing = emoteTimersRef.current.get(event.playerId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setBubbles((prev) => {
          const current = prev[event.playerId];
          if (!current || current.at !== event.at) return prev;
          const next = { ...prev };
          delete next[event.playerId];
          return next;
        });
        emoteTimersRef.current.delete(event.playerId);
      }, EMOTE_DISPLAY_MS);
      emoteTimersRef.current.set(event.playerId, timer);
    };

    const onPlayerItem = (event: PlayerItemEvent) => {
      if (event.code !== code) return;
      if (!isTableItemId(event.itemId)) return;
      const me = identityRef.current;
      // Sender already painted an optimistic throw.
      if (shouldIgnoreOwnSocialEcho(me?.playerId, event.fromPlayerId)) return;
      showThrow(event.fromPlayerId, event.targetPlayerId, event.itemId, event.at);
    };

    socket.on("player_emote", onPlayerEmote);
    socket.on("player_item", onPlayerItem);
    return () => {
      socket.off("player_emote", onPlayerEmote);
      socket.off("player_item", onPlayerItem);
    };
  }, [enabled, roomCode, showThrow]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      for (const timer of flightTimersRef.current.values()) clearTimeout(timer);
      flightTimersRef.current.clear();
    };
  }, []);

  const markCooldown = useCallback(() => {
    const until = Date.now() + EMOTE_COOLDOWN_MS;
    setCooldownUntil(until);
    setCoolingDown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(() => {
      setCoolingDown(false);
      cooldownTimerRef.current = null;
    }, EMOTE_COOLDOWN_MS);
  }, []);

  const clearCooldown = useCallback(() => {
    setCooldownUntil(0);
    setCoolingDown(false);
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const showBubble = useCallback((playerId: string, emoteId: EmoteId, at: number) => {
    setBubbles((prev) => ({
      ...prev,
      [playerId]: { playerId, emoteId, at },
    }));
    const existing = emoteTimersRef.current.get(playerId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setBubbles((prev) => {
        const current = prev[playerId];
        if (!current || current.at !== at) return prev;
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      emoteTimersRef.current.delete(playerId);
    }, EMOTE_DISPLAY_MS);
    emoteTimersRef.current.set(playerId, timer);
  }, []);

  const clearBubble = useCallback((playerId: string, at: number) => {
    setBubbles((prev) => {
      const current = prev[playerId];
      if (!current || current.at !== at) return prev;
      const next = { ...prev };
      delete next[playerId];
      return next;
    });
    const existing = emoteTimersRef.current.get(playerId);
    if (existing) {
      clearTimeout(existing);
      emoteTimersRef.current.delete(playerId);
    }
  }, []);

  const sendEmote = useCallback(
    (emoteId: EmoteId) => {
      if (!identity) return;
      if (Date.now() < cooldownUntil) return;
      if (!isEmoteId(emoteId)) return;

      const at = Date.now();
      // Lock menus immediately so the picker cannot reopen mid-flight.
      markCooldown();
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
            clearCooldown();
            clearBubble(identity.playerId, at);
            onError?.(res.error || "发送失败");
          }
        },
      );
    },
    [
      clearBubble,
      clearCooldown,
      cooldownUntil,
      identity,
      markCooldown,
      onError,
      roomCode,
      showBubble,
    ],
  );

  const throwItem = useCallback(
    (targetPlayerId: string, itemId: TableItemId) => {
      if (!identity) return;
      if (Date.now() < cooldownUntil) return;
      if (!isTableItemId(itemId)) return;
      if (targetPlayerId === identity.playerId) return;

      const at = Date.now();
      markCooldown();
      showThrow(identity.playerId, targetPlayerId, itemId, at);

      const socket = getSocket();
      socket.emit(
        "throw_item",
        {
          code: roomCode.toUpperCase(),
          playerId: identity.playerId,
          secret: identity.secret,
          targetPlayerId,
          itemId,
        },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok) {
            clearCooldown();
            onError?.(res.error || "投掷失败");
            return;
          }
        },
      );
    },
    [
      clearCooldown,
      cooldownUntil,
      identity,
      markCooldown,
      onError,
      roomCode,
      showThrow,
    ],
  );

  return {
    bubbles,
    hits,
    flights,
    sendEmote,
    throwItem,
    cooldownUntil,
    coolingDown,
  };
}
