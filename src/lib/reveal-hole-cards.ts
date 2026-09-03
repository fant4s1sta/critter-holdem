import type { Street } from "./types";

/** Decide whether a seat's hole cards belong in the public room state. */
export function shouldRevealHoleCards(input: {
  hasHoleCards: boolean;
  isViewer: boolean;
  isSpectator: boolean;
  street: Street | null | undefined;
  folded?: boolean;
  contenderCount: number;
}): boolean {
  if (!input.hasHoleCards) return false;
  if (input.isViewer || input.isSpectator) return true;
  // Only the remaining (non-folded) hands are tabled when comparing at showdown.
  return (
    input.street === "showdown" &&
    input.folded !== true &&
    input.contenderCount >= 2
  );
}
