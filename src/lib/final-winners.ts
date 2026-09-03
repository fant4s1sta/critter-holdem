import type { PublicPlayer } from "./types";

export function pickFinalWinners(players: PublicPlayer[]): PublicPlayer[] {
  if (players.length === 0) return [];
  const maxChips = Math.max(...players.map((player) => player.chips));
  return players.filter((player) => player.chips === maxChips);
}
