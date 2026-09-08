"use client";

import { useEffect, useState } from "react";
import { EMOTE_COOLDOWN_MS } from "@/lib/emotes";

/**
 * Radial cooldown wipe over a circular avatar.
 * Uses SVG stroke-dashoffset (smooth under parent re-renders) and a fixed
 * duration — no negative animation-delay seeking that jumps on each tick.
 */
export function AvatarCooldownRing({
  until,
  durationMs = EMOTE_COOLDOWN_MS,
}: {
  until: number;
  durationMs?: number;
}) {
  const [alive, setAlive] = useState(() => until > Date.now());

  useEffect(() => {
    const remaining = until - Date.now();
    if (!(until > 0) || remaining <= 0) {
      setAlive(false);
      return;
    }
    setAlive(true);
    const timer = setTimeout(() => setAlive(false), remaining);
    return () => clearTimeout(timer);
  }, [until]);

  if (!alive) return null;

  return (
    <div className="avatar-cooldown" key={until} aria-hidden>
      <svg className="avatar-cooldown-svg" viewBox="0 0 100 100">
        <circle
          className="avatar-cooldown-pie"
          cx="50"
          cy="50"
          r="50"
          pathLength={100}
          style={{ animationDuration: `${durationMs}ms` }}
        />
      </svg>
    </div>
  );
}

/** Pick the latest cooldown end time from several optional sources. */
export function latestCooldownUntil(...values: Array<number | null | undefined>) {
  let max = 0;
  for (const value of values) {
    if (typeof value === "number" && value > max) max = value;
  }
  return max;
}
