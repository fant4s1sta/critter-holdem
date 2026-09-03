import assert from "node:assert/strict";
import {
  getSeatLayout,
  SEAT_TO_CUP,
  TABLE_SEAT_CUPS,
} from "./seat-layout";

assert.equal(TABLE_SEAT_CUPS.length, 10);
assert.deepEqual(SEAT_TO_CUP, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.equal(SEAT_TO_CUP.length, 10);

const ten = Array.from({ length: 10 }, (_, seat) => ({
  id: `player-${seat}`,
  seat,
}));

const layout = getSeatLayout(ten);
assert.equal(layout.length, 10);
assert.deepEqual(
  layout.map((s) => s.player.seat),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
);
assert.deepEqual(layout.map((s) => s.cupIndex), SEAT_TO_CUP);
assert.equal(layout[0].cupIndex, 0);
assert.equal(layout[9].cupIndex, 9);

const sparse = getSeatLayout([
  { id: "a", seat: 0 },
  { id: "c", seat: 5 },
  { id: "b", seat: 2 },
]);
assert.deepEqual(
  sparse.map((s) => [s.player.seat, s.cupIndex]),
  [
    [0, 0],
    [2, 2],
    [5, 5],
  ],
);

console.log("seat layout tests passed");
