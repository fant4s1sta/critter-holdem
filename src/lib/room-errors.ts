/** Server/client copy for a missing or expired room. */
export function isRoomMissingError(message: string): boolean {
  return /房间不存在/.test(message);
}

export function isRoomRevisionConflict(message: string): boolean {
  return /revision conflict|版本冲突/i.test(message);
}
