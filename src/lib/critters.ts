export const CRITTERS = {
  panda: { icon: '🐼', model: '/models/panda/panda-rigged-v2.glb', pawColor: '#24282d' },
  pig: { icon: '🐷', model: '/models/pig/pig-rigged.glb', pawColor: '#b46e59' },
  fox: { icon: '🦊', model: '/models/fox/fox-rigged.glb', pawColor: '#563629' },
} as const;
export type CritterKind = keyof typeof CRITTERS;
const SEAT_KINDS: readonly CritterKind[] = ['panda', 'pig', 'fox'];

/** A stable room seat keeps the same animal for every viewer and reconnect. */
export const critterKindForSeat = (seat: number): CritterKind => SEAT_KINDS[seat % SEAT_KINDS.length];
export const critterIconForSeat = (seat: number) => CRITTERS[critterKindForSeat(seat)].icon;
