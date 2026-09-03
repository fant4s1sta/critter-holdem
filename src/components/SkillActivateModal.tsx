"use client";

import { useMemo, useState } from "react";
import type { AnimalId, RoomPublicState } from "@/lib/types";
import { AnimalAvatar } from "./AnimalAvatar";
import { getAnimalSkill } from "@/lib/skill-catalog";
import { PlayingCard } from "./PlayingCard";
import { CardBack } from "./CardBack";
import { getCardRenderKey } from "@/lib/card-visuals";

export function SkillActivateModal({
  open,
  onClose,
  animalId,
  room,
  meId,
  skillState,
  raiseTo,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  animalId: AnimalId;
  room: RoomPublicState;
  meId: string;
  skillState: NonNullable<NonNullable<RoomPublicState["you"]>["skill"]>;
  raiseTo: number;
  onConfirm: (
    payload: {
      targetPlayerId?: string;
      communityIndex?: number;
      raiseTo?: number;
    },
    reportError: (message: string) => void,
  ) => void;
}) {
  const skill = getAnimalSkill(animalId);
  const [targetPlayerId, setTargetPlayerId] = useState<string>("");
  const [communityIndex, setCommunityIndex] = useState(0);
  const [ambushRaise, setAmbushRaise] = useState(raiseTo);
  const [castError, setCastError] = useState("");

  const selfId = room.you?.playerId || meId;
  const targets = useMemo(
    () =>
      room.players.filter(
        (p) =>
          p.id !== selfId &&
          !p.folded &&
          (p.holeCardCount ?? 0) > 0,
      ),
    [room.players, selfId],
  );

  if (!open) return null;

  const dealt = room.game?.communityCards.length ?? 0;
  const upcomingCount =
    skill.target === "upcoming-card" ? (dealt === 0 ? 3 : dealt >= 5 ? 0 : 1) : 0;
  const selectedUpcoming =
    upcomingCount > 0 ? Math.min(communityIndex, upcomingCount - 1) : 0;

  const blockReason = castError || (!skillState.canUseActive ? skillState.disabledReason : "");
  const canConfirm =
    skillState.canUseActive &&
    !castError &&
    (skill.target === "none" ||
      (skill.target === "player" && !!targetPlayerId) ||
      (skill.target === "community-card" &&
        (room.game?.communityCards.length ?? 0) > 0) ||
      (skill.target === "upcoming-card" && upcomingCount > 0) ||
      (skill.target === "raise-amount" && ambushRaise > 0));

  return (
    <div
      className="px-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-modal-title"
      onClick={onClose}
    >
      <div
        className="lobby-panel animate-fade-up w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="skill-modal-title"
          className="text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
        >
          <span className="inline-flex items-center gap-1.5">
            <AnimalAvatar id={animalId} size="xs" />
            {skill.name}
          </span>
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
          {skill.usage}
        </p>
        <p className="mt-2 text-sm leading-relaxed font-semibold text-[var(--lobby-ink,#4a220c)]">
          {skill.summary}
        </p>

        {blockReason ? (
          <p className="lobby-error mt-3 text-sm" role="alert">
            {blockReason}
          </p>
        ) : null}

        {skill.target === "player" && skillState.canUseActive ? (
          <div className="mt-3 space-y-1.5">
            <p className="lobby-label">选择目标</p>
            <div className="grid grid-cols-2 gap-1.5">
              {targets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`lobby-btn-sm text-xs ${
                    targetPlayerId === p.id ? "lobby-cta" : "lobby-btn"
                  }`}
                  onClick={() => setTargetPlayerId(p.id)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <AnimalAvatar id={p.avatarId} size="xs" />
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
            {targets.length === 0 ? (
              <p className="text-xs font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
                没有可选目标
              </p>
            ) : null}
          </div>
        ) : null}

        {skill.target === "community-card" && skillState.canUseActive ? (
          <div className="mt-3 space-y-1.5">
            <p className="lobby-label">选择公共牌</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {(room.game?.communityCards ?? []).map((card, index) => (
                <button
                  key={`${getCardRenderKey(card, room.game?.handNumber ?? 0)}-${index}`}
                  type="button"
                  className={`rounded-lg border-[3px] p-0.5 ${
                    communityIndex === index
                      ? "border-[#e89a2e]"
                      : "border-transparent"
                  }`}
                  onClick={() => setCommunityIndex(index)}
                >
                  <PlayingCard card={card} size="lg" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {skill.target === "upcoming-card" &&
        skillState.canUseActive &&
        upcomingCount > 1 &&
        !skillState.scoutCards?.[0] ? (
          <div className="mt-3 space-y-1.5">
            <p className="lobby-label">选择要看的一张</p>
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: upcomingCount }, (_, index) => (
                <button
                  key={`upcoming-${index}`}
                  type="button"
                  className={`rounded-lg border-[3px] p-0.5 ${
                    selectedUpcoming === index
                      ? "border-[#e89a2e]"
                      : "border-transparent"
                  }`}
                  onClick={() => setCommunityIndex(index)}
                >
                  <CardBack sizeClass="playing-card playing-card-lg" animate={false} />
                  <span className="mt-1 block text-center text-xs font-extrabold text-[var(--lobby-ink,#4a220c)]">
                    第{index + 1}张
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {skill.target === "raise-amount" && skillState.canUseActive ? (
          <label className="game-range-label mt-3">
            <span>
              {skill.skillId === "fraud" ? "欺诈加注至" : "加注至"} {ambushRaise}
            </span>
            <input
              type="range"
              min={room.you?.minRaiseTo ?? 0}
              max={Math.max(room.you?.minRaiseTo ?? 0, room.you?.maxRaiseTo ?? 0)}
              value={Math.min(
                Math.max(ambushRaise, room.you?.minRaiseTo ?? 0),
                room.you?.maxRaiseTo ?? 0,
              )}
              onChange={(e) => setAmbushRaise(Number(e.target.value))}
            />
          </label>
        ) : null}

        {skillState.scoutCards?.[0] ? (
          <div className="mt-3">
            <p className="lobby-label">探路预览</p>
            <div className="mt-1 flex justify-center">
              <PlayingCard card={skillState.scoutCards[0]} size="lg" />
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="lobby-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="lobby-cta"
            disabled={!canConfirm}
            onClick={() => {
              setCastError("");
              if (
                skill.target === "player" &&
                (!targetPlayerId || targetPlayerId === selfId)
              ) {
                setCastError("不能选择自己");
                return;
              }
              onConfirm(
                {
                  targetPlayerId: targetPlayerId || undefined,
                  communityIndex:
                    skill.target === "community-card"
                      ? communityIndex
                      : skill.target === "upcoming-card"
                        ? selectedUpcoming
                        : undefined,
                  raiseTo:
                    skill.target === "raise-amount" ? ambushRaise : undefined,
                },
                (message) => setCastError(message),
              );
            }}
          >
            发动
          </button>
        </div>
      </div>
    </div>
  );
}
