/** Whether a seated client should ignore its own social broadcast echo. */
export function shouldIgnoreOwnSocialEcho(
  selfPlayerId: string | null | undefined,
  fromPlayerId: string,
): boolean {
  return !!selfPlayerId && selfPlayerId === fromPlayerId;
}
