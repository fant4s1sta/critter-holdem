"use client";

import type { ReactNode } from "react";
import type { EmoteId } from "@/lib/emotes";
import type { EmotePickerPlacement } from "@/lib/seat-layout";
import type { TableItemId } from "@/lib/table-items";
import type { SeatEmoteBubble, SeatItemHit } from "@/lib/use-table-social";
import { EmotePicker, SeatEmoteBubble as EmoteBubble } from "./EmotePicker";
import { ItemHitFx } from "./BombHit";
import { ItemPicker } from "./ItemPicker";

export function SeatSocialStack({
  playerId,
  canUseSocial,
  isSelf,
  coolingDown,
  placement,
  emote,
  itemHit,
  onSendEmote,
  onThrowItem,
  avatarClassName,
  name,
  children,
}: {
  playerId: string;
  canUseSocial: boolean;
  isSelf: boolean;
  coolingDown: boolean;
  placement: EmotePickerPlacement;
  emote?: SeatEmoteBubble;
  itemHit?: SeatItemHit;
  onSendEmote: (emoteId: EmoteId) => void;
  onThrowItem: (itemId: TableItemId) => void;
  avatarClassName: string;
  name: string;
  children: ReactNode;
}) {
  const title = canUseSocial
    ? isSelf
      ? "点头像发表情"
      : "点头像扔道具"
    : name;
  const avatar = (
    <div
      className={avatarClassName}
      data-seat-avatar={playerId}
      title={title}
      aria-label={title}
    >
      {children}
    </div>
  );

  return (
    <div
      data-seat-player-id={playerId}
      className={`relative seat-avatar-stack${
        itemHit?.itemId === "bomb"
          ? " is-bomb-hit is-landed"
          : itemHit?.itemId === "heart"
            ? " is-heart-hit is-landed"
            : itemHit
              ? " is-splat-hit is-landed"
              : ""
      }`}
    >
      {emote ? <EmoteBubble emoteId={emote.emoteId} at={emote.at} /> : null}
      {itemHit ? (
        <ItemHitFx key={itemHit.at} itemId={itemHit.itemId} at={itemHit.at} landed />
      ) : null}
      {canUseSocial && isSelf ? (
        <EmotePicker coolingDown={coolingDown} placement={placement} onSend={onSendEmote}>
          {avatar}
        </EmotePicker>
      ) : canUseSocial && !isSelf ? (
        <ItemPicker coolingDown={coolingDown} placement={placement} onThrow={onThrowItem}>
          {avatar}
        </ItemPicker>
      ) : (
        avatar
      )}
    </div>
  );
}
