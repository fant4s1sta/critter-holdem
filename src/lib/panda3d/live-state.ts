import type { PublicPlayer, RoomPublicState } from '../types';

import { CHIP_VALUES, isChipAmount } from '../chips';
export const CHIP_COLORS = ['#427c59', '#bd5039', '#d6a133', '#427bbd', '#8757aa'] as const;

/** Preserve clockwise order relative to the viewer, including eliminated seats. */
export function liveSeatMap(room: RoomPublicState) {
  const sorted = [...room.players].sort((a,b)=>a.seat-b.seat);
  const viewer = sorted.findIndex(p=>p.id===room.you.playerId);
  const me = viewer >= 0 ? sorted[viewer] : undefined;
  const opponents = viewer >= 0
    ? [...sorted.slice(viewer+1), ...sorted.slice(0,viewer)]
    : sorted.slice(1);
  const slots: Record<number, number[]> = {
    0: [], 1: [2], 2: [3,1], 3: [4,2,0], 4: [4,3,1,0],
    5: [4,3,2,1,0], 6: [6,4,3,1,0,5], 7: [6,4,3,2,1,0,5],
  };
  const mapped: (PublicPlayer | undefined)[] = Array(7).fill(undefined);
  opponents.forEach((p,i)=>{mapped[slots[opponents.length][i]]=p;});
  return { me, foreground: me ?? sorted[0], opponents: mapped, layout: (sorted.length > 6 ? 8 : 6) as 6 | 8 };
}

export function chipBreakdown(counts: number[]) {
  return CHIP_VALUES.map((value, i) => ({value, count: counts[i], slot: i}))
    .filter(stack => stack.count > 0).reverse();
}

export function selectedRaise(room: RoomPublicState, contribution:number) {
  const me=room.players.find(p=>p.id===room.you.playerId);
  if (!me || !room.game || !isChipAmount(contribution) || contribution<=0 || contribution>me.chips) return null;
  if (contribution===me.chips && (room.you.canRaise || contribution===room.you.callAmount)) return {type:'all-in' as const};
  if (!room.you.canRaise) return null;
  const target=me.betThisStreet+contribution;
  if (target<=room.game.currentBet || target<room.you.minRaiseTo) return null;
  return {type:room.game.currentBet===0?'bet' as const:'raise' as const,amount:target};
}
