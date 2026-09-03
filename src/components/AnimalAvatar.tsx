"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { AnimalId } from "@/lib/types";
import {
  UNSET_AVATAR_EMOJI,
  animalAvatarBg,
  animalAvatarScale,
  animalAvatarSrc,
  animalName,
  isImagePreloaded,
  markImageLoaded,
  preloadImage,
} from "@/lib/animal-display";

export function AnimalAvatar({
  id,
  size = "sm",
  className = "",
  eliminated = false,
  priority = "auto",
}: {
  id: AnimalId | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "fill";
  className?: string;
  eliminated?: boolean;
  priority?: "high" | "auto";
}) {
  const src = animalAvatarSrc(id);
  const name = animalName(id);
  const bg = animalAvatarBg(id);
  const scale = animalAvatarScale(id);
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(() => (src ? isImagePreloaded(src) : false));
  const wrapClass =
    `animal-avatar-wrap animal-avatar-${size} ${ready || !src ? "is-ready" : ""} ${
      eliminated ? "is-eliminated" : ""
    } ${className}`.trim();

  const markReady = useCallback(() => {
    if (!src) return;
    markImageLoaded(src);
    setReady(true);
  }, [src]);

  useLayoutEffect(() => {
    if (!src) {
      setReady(false);
      return;
    }
    if (isImagePreloaded(src)) {
      setReady(true);
      return;
    }
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      markReady();
      return;
    }
    let cancelled = false;
    void preloadImage(src).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [src, markReady]);

  if (!src) {
    return (
      <span className={`${wrapClass} animal-avatar-fallback`} aria-hidden>
        {UNSET_AVATAR_EMOJI}
      </span>
    );
  }

  return (
    <span
      className={wrapClass}
      style={{ backgroundColor: bg, "--avatar-scale": scale } as CSSProperties}
    >
      <img
        ref={imgRef}
        src={src}
        alt={name}
        className="animal-avatar"
        draggable={false}
        decoding="sync"
        fetchPriority={priority}
        onLoad={markReady}
      />
    </span>
  );
}
