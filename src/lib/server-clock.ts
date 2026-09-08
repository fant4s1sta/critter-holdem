/**
 * Server clock offset. Turn / next-hand countdowns compare server timestamps
 * (`turnEndsAt`, `nextHandAt`) against local time; phones drift by seconds,
 * so we calibrate against `serverNow` stamped on every room broadcast.
 */

let offsetMs = 0;
let sampled = false;

/** Smooth toward the new sample; the first one is taken as-is. */
const SMOOTHING = 0.3;

export function recordServerClock(serverNow: number | undefined, localNow = Date.now()) {
  if (typeof serverNow !== "number" || !Number.isFinite(serverNow)) return;
  const sample = serverNow - localNow;
  if (!sampled) {
    offsetMs = sample;
    sampled = true;
    return;
  }
  offsetMs += (sample - offsetMs) * SMOOTHING;
}

export function serverClockOffsetMs(): number {
  return offsetMs;
}

/** Best estimate of the server's `Date.now()`. */
export function serverNow(localNow = Date.now()): number {
  return localNow + offsetMs;
}

/** Test-only reset. */
export function resetServerClockForTests() {
  offsetMs = 0;
  sampled = false;
}
