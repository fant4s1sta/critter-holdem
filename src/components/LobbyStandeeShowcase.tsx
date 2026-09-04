"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type TransitionEvent } from "react";
import { ANIMALS, type AnimalId, type RuleMode } from "@/lib/types";
import { getAnimalSkill } from "@/lib/skill-catalog";
import {
  animalName,
  animalStandeeScale,
  animalStandeeSrc,
  preloadImage,
} from "@/lib/animal-display";
import { LOBBY_STANDEE_ANCHOR } from "@/lib/seat-layout";
import { BrandLogo } from "./BrandLogo";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LobbyStandeeShowcase({
  avatarId,
  ruleMode,
}: {
  avatarId: AnimalId | null;
  ruleMode: RuleMode;
}) {
  const [shownId, setShownId] = useState<AnimalId | null>(null);
  const [flipped, setFlipped] = useState(false);
  const pendingRef = useRef<AnimalId | null>(avatarId);
  const shownRef = useRef<AnimalId | null>(null);
  const flippedRef = useRef(false);

  const shownAnimal = useMemo(
    () => (shownId ? ANIMALS.find((item) => item.id === shownId) : null),
    [shownId],
  );
  const shownSkill = useMemo(
    () => (shownId ? getAnimalSkill(shownId) : null),
    [shownId],
  );
  const shownSrc = animalStandeeSrc(shownId);
  const shownName = animalName(shownId);

  useEffect(() => {
    shownRef.current = shownId;
  }, [shownId]);

  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

  useEffect(() => {
    pendingRef.current = avatarId;
    const src = animalStandeeSrc(avatarId);
    if (src) void preloadImage(src);

    if (prefersReducedMotion()) {
      setShownId(avatarId);
      setFlipped(Boolean(avatarId));
      return;
    }

    if (flippedRef.current) {
      if (shownRef.current === avatarId) return;
      setFlipped(false);
      return;
    }

    if (!avatarId) {
      setShownId(null);
      return;
    }

    if (shownRef.current === avatarId) {
      setFlipped(true);
      return;
    }

    setShownId(avatarId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFlipped(true));
    });
  }, [avatarId]);

  function onFlipEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "transform") return;
    if (event.target !== event.currentTarget) return;

    const next = pendingRef.current;
    if (flippedRef.current) {
      if (next !== shownRef.current) setFlipped(false);
      return;
    }

    if (!next) {
      setShownId(null);
      return;
    }

    setShownId(next);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFlipped(true));
    });
  }

  return (
    <div
      className={`lobby-standee-dock${flipped && shownId ? " is-face-up" : ""}`}
      style={{
        left: `${LOBBY_STANDEE_ANCHOR.x}%`,
        top: `${LOBBY_STANDEE_ANCHOR.y}%`,
      }}
    >
      <div className={`lobby-standee-flip${flipped ? " is-flipped" : ""}`}>
        <div className="card-flip-inner" onTransitionEnd={onFlipEnd}>
          <div className="card-flip-face card-flip-back lobby-standee-card is-back">
            <BrandLogo variant="card-back" />
          </div>
          <div className="card-flip-face card-flip-front lobby-standee-card">
            {shownAnimal && shownSrc ? (
              <div
                className="lobby-standee-portrait"
                style={{ "--standee-scale": animalStandeeScale(shownId) } as CSSProperties}
              >
                <img
                  src={shownSrc}
                  alt=""
                  className="lobby-standee-art"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {ruleMode === "skill" && shownAnimal && shownSkill ? (
        <div className="lobby-standee-sticker">
          <p className="skill">
            {shownName} · {shownSkill.name}
          </p>
          <p className="summary">{shownSkill.summary}</p>
        </div>
      ) : null}
    </div>
  );
}
