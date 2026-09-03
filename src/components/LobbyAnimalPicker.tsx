"use client";

import { useMemo } from "react";
import { ANIMALS, type AnimalId, type RuleMode } from "@/lib/types";
import { getAnimalSkill } from "@/lib/skill-catalog";
import { AnimalAvatar } from "./AnimalAvatar";

export function LobbyAnimalPicker({
  avatarId,
  ruleMode,
  onSelect,
}: {
  avatarId: AnimalId | null;
  ruleMode: RuleMode;
  onSelect: (id: AnimalId) => void;
}) {
  const selectedAnimal = useMemo(
    () => (avatarId ? ANIMALS.find((a) => a.id === avatarId) : null),
    [avatarId],
  );
  const selectedSkill = useMemo(
    () => (avatarId ? getAnimalSkill(avatarId) : null),
    [avatarId],
  );

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
            <AnimalAvatar id={animal.id} size="fill" priority="high" />
          </button>
        ))}
      </div>
      {ruleMode === "skill" && selectedAnimal && selectedSkill ? (
        <div className="lobby-skill-blurb">
          <p className="title">
            <AnimalAvatar id={selectedAnimal.id} size="xs" />
            {selectedAnimal.name} · {selectedSkill.name}
            <span className="usage">（{selectedSkill.usage}）</span>
          </p>
          <p className="summary">{selectedSkill.summary}</p>
        </div>
      ) : null}
    </div>
  );
}
