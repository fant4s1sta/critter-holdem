export type CritterKind = 'panda' | 'pig';

/** A stable room seat keeps the same animal for every viewer and reconnect. */
export const critterKindForSeat = (seat: number): CritterKind => seat % 2 === 1 ? 'pig' : 'panda';
export const critterIconForSeat = (seat: number) => critterKindForSeat(seat) === 'pig' ? '🐷' : '🐼';
