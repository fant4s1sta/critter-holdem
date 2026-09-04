"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TransitionEvent,
} from "react";
import { ANIMALS, type AnimalId, type RuleMode } from "@/lib/types";
import { getAnimalSkill } from "@/lib/skill-catalog";
import {
  ANIMAL_STANDEE_SRCS,
  animalName,
  animalStandeeSrc,
  decodeImage,
  markImageLoaded,
  preloadAllAnimalStandees,
  preloadImage,
} from "@/lib/animal-display";
import { LOBBY_STANDEE_ANCHOR } from "@/lib/seat-layout";
import { BrandLogo } from "./BrandLogo";

type FlipPhase = "back" | "to-back" | "to-front" | "front";

const FLIP_FALLBACK_MS = 700;
const PAINT_FALLBACK_MS = 480;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function StandeeArt({
  id,
  onPainted,
}: {
  id: AnimalId;
  onPainted: (id: AnimalId) => void;
}) {
  const src = animalStandeeSrc(id);
  const imgRef = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    if (!src) return;
    const img = imgRef.current;
    if (!img) return;
    let cancelled = false;

    const finish = async () => {
      try {
        if (typeof img.decode === "function") await img.decode();
      } catch {
        /* broken decode should not block the flip */
      }
      if (cancelled) return;
      markImageLoaded(src);
      onPainted(id);
    };

    if (img.complete && img.naturalWidth > 0) {
      void finish();
      return () => {
        cancelled = true;
      };
    }

    const onLoad = () => {
      void finish();
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onLoad);
    return () => {
      cancelled = true;
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onLoad);
    };
  }, [id, src, onPainted]);

  if (!src) return null;

  return (
    <div className="lobby-standee-portrait">
      {/* eslint-disable-next-line @next/next/no-img-element -- standee must decode on the 3D card face */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        className="lobby-standee-art"
        width={508}
        height={768}
        draggable={false}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
    </div>
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
  const phaseRef = useRef<FlipPhase>("back");
  const revealGen = useRef(0);
  const flipTimerRef = useRef<number | null>(null);
  const paintedRef = useRef<{ id: AnimalId; resolve: () => void } | null>(null);
  const revealFrontRef = useRef<(id: AnimalId) => Promise<void>>(async () => undefined);
  const settleFlipRef = useRef<() => void>(() => undefined);

  const shownAnimal = useMemo(
    () => (shownId ? ANIMALS.find((item) => item.id === shownId) : null),
    [shownId],
  );
  const shownSkill = useMemo(
    () => (shownId ? getAnimalSkill(shownId) : null),
    [shownId],
  );
  const shownName = animalName(shownId);

  useEffect(() => {
    shownRef.current = shownId;
  }, [shownId]);

  const onPainted = useCallback((id: AnimalId) => {
    if (paintedRef.current?.id !== id) return;
    paintedRef.current.resolve();
    paintedRef.current = null;
  }, []);

  function clearFlipTimer() {
    if (flipTimerRef.current == null) return;
    window.clearTimeout(flipTimerRef.current);
    flipTimerRef.current = null;
  }

  function armFlipTimer() {
    clearFlipTimer();
    flipTimerRef.current = window.setTimeout(() => {
      flipTimerRef.current = null;
      settleFlipRef.current();
    }, FLIP_FALLBACK_MS);
  }

  revealFrontRef.current = async (id: AnimalId) => {
    const gen = ++revealGen.current;
    const src = animalStandeeSrc(id);
    if (src) await decodeImage(src);
    if (gen !== revealGen.current || pendingRef.current !== id) return;

    const painted = new Promise<void>((resolve) => {
      paintedRef.current = { id, resolve };
    });
    setShownId(id);
    await Promise.race([
      painted,
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, PAINT_FALLBACK_MS);
      }),
    ]);
    if (gen !== revealGen.current || pendingRef.current !== id) return;

    if (prefersReducedMotion()) {
      phaseRef.current = "front";
      setFlipped(true);
      return;
    }
    phaseRef.current = "to-front";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== revealGen.current || pendingRef.current !== id) return;
        setFlipped(true);
        armFlipTimer();
      });
    });
  };

  settleFlipRef.current = () => {
    clearFlipTimer();
    const next = pendingRef.current;
    if (phaseRef.current === "to-front") {
      phaseRef.current = "front";
      if (next !== shownRef.current) {
        phaseRef.current = "to-back";
        setFlipped(false);
        armFlipTimer();
      }
      return;
    }
    if (phaseRef.current !== "to-back") return;
    phaseRef.current = "back";
    if (!next) {
      setShownId(null);
      return;
    }
    void revealFrontRef.current(next);
  };

  useEffect(() => {
    void preloadAllAnimalStandees();
  }, []);

  useEffect(() => {
    pendingRef.current = avatarId;
    const src = animalStandeeSrc(avatarId);
    if (src) void preloadImage(src);

    if (prefersReducedMotion()) {
      revealGen.current += 1;
      phaseRef.current = avatarId ? "front" : "back";
      setShownId(avatarId);
      setFlipped(Boolean(avatarId));
      return;
    }

    const phase = phaseRef.current;
    if (phase === "front") {
      if (shownRef.current === avatarId) return;
      phaseRef.current = "to-back";
      setFlipped(false);
      armFlipTimer();
      return;
    }
    if (phase === "to-back" || phase === "to-front") return;
    if (!avatarId) {
      setShownId(null);
      return;
    }
    void revealFrontRef.current(avatarId);
    // Flip timer is ref-backed; including it would retrigger the machine every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId]);

  useEffect(
    () => () => {
      clearFlipTimer();
      revealGen.current += 1;
    },
    [],
  );

  function onFlipEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== "transform") return;
    if (event.target !== event.currentTarget) return;
    settleFlipRef.current();
  }

  return (
    <div
      className={`lobby-standee-dock${flipped && shownId ? " is-face-up" : ""}`}
      style={{
        left: `${LOBBY_STANDEE_ANCHOR.x}%`,
        top: `${LOBBY_STANDEE_ANCHOR.y}%`,
      }}
    >
      <div className="lobby-standee-preload" aria-hidden>
        {ANIMAL_STANDEE_SRCS.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element -- offscreen decode cache for WebKit 3D faces
          <img key={src} src={src} alt="" width={508} height={768} decoding="async" />
        ))}
      </div>
      <div className={`lobby-standee-flip${flipped ? " is-flipped" : ""}`}>
        <div className="card-flip-inner" onTransitionEnd={onFlipEnd}>
          <div className="card-flip-face card-flip-back lobby-standee-card is-back">
            <BrandLogo variant="card-back" />
          </div>
          <div className="card-flip-face card-flip-front lobby-standee-card">
            {shownId ? <StandeeArt key={shownId} id={shownId} onPainted={onPainted} /> : null}
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
