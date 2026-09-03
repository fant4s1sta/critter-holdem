/** Canonical invite URL for a room (query form works best in WeChat on iOS). */
export function buildInviteUrl(roomCode: string): string {
  const code = roomCode.replace(/\D/g, "").slice(0, 6);
  if (typeof window === "undefined") {
    return `/?room=${code}`;
  }
  return `${window.location.origin}/?room=${code}`;
}
