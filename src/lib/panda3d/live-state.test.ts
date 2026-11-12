import assert from 'node:assert/strict';
import {liveSeatMap,chipBreakdown,selectedRaise} from './live-state';
import type {RoomPublicState} from '../types';
import {chipTotal} from '../chips';
for(let n=2;n<=8;n++)for(let viewer=0;viewer<n;viewer++){
 const players=Array.from({length:n},(_,seat)=>({id:String(seat),seat,chips:1000}));
 const room={players,you:{playerId:String(viewer)}} as RoomPublicState;
 const mapping=liveSeatMap(room);
 assert.equal(mapping.me?.id,String(viewer));
 assert.equal(mapping.opponents.filter(Boolean).length,n-1);
 assert.equal(new Set(mapping.opponents.filter(Boolean).map(p=>p!.id)).size,n-1);
 assert.equal(mapping.layout,n>6?8:6);
}
assert.deepEqual(chipBreakdown([2, 0, 1, 0, 1]), [
  {value: 500, count: 1, slot: 4},
  {value: 50, count: 1, slot: 2},
  {value: 10, count: 2, slot: 0},
]);
assert.deepEqual(chipBreakdown([0, 0, 0, 0, 0]), []);
assert.equal(chipTotal([1,2,3,4,5]),3100);
const room={players:[{id:'me',chips:90,betThisStreet:10}],you:{playerId:'me',minRaiseTo:40,canRaise:true},game:{currentBet:20}} as RoomPublicState;
assert.equal(selectedRaise(room,10),null);
assert.equal(selectedRaise(room,20),null);
assert.deepEqual(selectedRaise(room,30),{type:'raise',amount:40});
assert.deepEqual(selectedRaise(room,90),{type:'all-in'});
assert.equal(selectedRaise(room,100),null);
console.log('live 3D state tests passed');
