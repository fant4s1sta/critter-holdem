"use client";

import { ANIMALS, type AnimalId } from "@/lib/types";
import { animalAvatarBg } from "@/lib/animal-display";
import { AnimalAvatar } from "./AnimalAvatar";
import { PokerChipFrame } from "./PokerChipFrame";

export function LobbyAnimalPicker({
  avatarId,
  onSelect,
}: {
  avatarId: AnimalId | null;
  onSelect: (id: AnimalId) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="lobby-label">选择你的动物</span>
      <div className="lobby-animal-grid">
        {ANIMALS.map((animal) => (
          <button
            key={animal.id}
            type="button"
            title={animal.name}
            aria-label={animal.name}
            data-guard-ms="120"
            onClick={() => onSelect(animal.id)}
            className={`lobby-animal-cell${avatarId === animal.id ? " is-selected" : ""}`}
          >
            <span className="lobby-chip">
              <PokerChipFrame
                id={animal.id}
                color={animalAvatarBg(animal.id)}
                selected={avatarId === animal.id}
              />
              <span className="lobby-chip-face">
                <AnimalAvatar id={animal.id} size="fill" priority="high" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
