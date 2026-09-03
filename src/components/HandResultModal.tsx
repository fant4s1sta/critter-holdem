"use client";

import type { Card, PublicPlayer, TexasHoldemPublicState } from "@/lib/types";
import { AnimalAvatar } from "./AnimalAvatar";
import { PlayingCard } from "./PlayingCard";

export function HandResultModal({
  game,
  players,
  onClose,
}: {
  game: TexasHoldemPublicState;
  players: PublicPlayer[];
  onClose: () => void;
}) {
  const rows = [...(game.handSummary ?? [])]
    .filter((row) => !row.folded)
    .sort((a, b) => {
      if (b.winAmount !== a.winAmount) return b.winAmount - a.winAmount;
      const seatA = players.find((p) => p.id === a.playerId)?.seat ?? 0;
      const seatB = players.find((p) => p.id === b.playerId)?.seat ?? 0;
      return seatA - seatB;
    });

  return (
    <div
      className="px-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-result-title"
      onClick={onClose}
    >
      <div
        className="lobby-panel animate-fade-up flex max-h-[min(34rem,calc(var(--stage-h)*0.82))] w-full max-w-sm flex-col p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="hand-result-title"
          className="text-center text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
        >
          本手结算
        </p>
        {game.communityCards.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {game.communityCards.map((card, index) => (
              <PlayingCard
                key={`${card.rank}${card.suit}-${index}`}
                card={card}
                size="sm"
              />
            ))}
          </div>
        ) : null}
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rows.map((row) => {
            const player = players.find((p) => p.id === row.playerId);
            const won = row.winAmount > 0;
            return (
              <li
                key={row.playerId}
                className={`rounded-xl border-[3px] px-2.5 py-2 ${
                  won
                    ? "border-[#c45e1c] bg-gradient-to-b from-[#fff8e0] to-[#ffd45c]"
                    : "border-[#8f3c10] bg-gradient-to-b from-[#fff9e8] to-[#f3e0b0]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <AnimalAvatar
                    id={player?.avatarId ?? null}
                    size="xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--lobby-ink,#4a220c)]">
                      {player?.name ?? "玩家"}
                      {won ? (
                        <span className="ml-1.5 font-extrabold text-[#8f3c10]">
                          赢家
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
                      {row.handName ?? "—"}
                      {won ? (
                        <span className="ml-1.5 font-extrabold text-[#8f3c10]">
                          +{row.winAmount}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {row.holeCards.map((card: Card, index) => (
                      <PlayingCard
                        key={`${row.playerId}-${card.rank}${card.suit}-${index}`}
                        card={card}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="lobby-cta mt-4 w-full"
          onClick={onClose}
        >
          知道了
        </button>
      </div>
    </div>
  );
}
