"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { EMOTE_COOLDOWN_MS } from "@/lib/emotes";

/**
 * Radial cooldown wipe over a circular avatar (no clock hand).
 * `until` is an absolute timestamp; the ring remounts whenever it changes.
 */
export function AvatarCooldownRing({
  until,
  durationMs = EMOTE_COOLDOWN_MS,
}: {
  until: number;
  durationMs?: number;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const remaining = until - Date.now();
    if (!(until > 0) || remaining <= 0) {
      setActive(false);
      return;
    }
    setActive(true);
    const timer = setTimeout(() => setActive(false), remaining);
    return () => clearTimeout(timer);
  }, [until]);

  if (!active) return null;

  const elapsed = Math.max(0, durationMs - (until - Date.now()));
  const delayMs = -Math.min(elapsed, durationMs - 16);

  return (
    <div
      className="avatar-cooldown"
      key={until}
      style={
        {
          "--cooldown-ms": `${durationMs}ms`,
          "--cooldown-delay": `${delayMs}ms`,
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="avatar-cooldown-wedge" />
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
