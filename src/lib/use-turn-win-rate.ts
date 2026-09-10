"use client";

import { useMemo } from "react";
import { countLiveOpponents, estimateTurnWinRate } from "./equity";
import type { PublicPlayer, RoomPublicState } from "./types";

export function useTurnWinRate(
  room: RoomPublicState | null,
  me: PublicPlayer | undefined,
): number | null {
  const holeKey =
    me?.holeCards?.map((card) => `${card.rank}${card.suit}`).join("") ?? "";
  const boardKey =
    room?.game?.communityCards.map((card) => `${card.rank}${card.suit}`).join("") ??
    "";
  const liveOpponents =
    me && room ? countLiveOpponents(room.players, me.id) : 0;

  return useMemo(
    () =>
      estimateTurnWinRate({
        canAct: room?.you?.canAct,
        folded: me?.folded,
        holeCards: me?.holeCards,
        communityCards: room?.game?.communityCards,
        street: room?.game?.street,
        opponentCount: liveOpponents,
      }),
    [
      boardKey,
      holeKey,
      liveOpponents,
      me?.folded,
      me?.holeCards,
      room?.game?.communityCards,
      room?.game?.street,
      room?.you?.canAct,
    ],
  );
}
