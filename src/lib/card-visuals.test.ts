import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  SUIT_LABELS,
  getCardAssetPath,
  getCardRenderKey,
  revealStepDelay,
} from "./card-visuals";

assert.deepEqual(Object.keys(SUIT_LABELS).sort(), ["c", "d", "h", "s"]);
assert.equal(SUIT_LABELS.s, "黑桃");
assert.equal(SUIT_LABELS.h, "红心");
assert.equal(SUIT_LABELS.d, "方块");
assert.equal(SUIT_LABELS.c, "梅花");
assert.equal(getCardAssetPath({ rank: "T", suit: "h" }), "/cards/hearts_10.png");
assert.equal(revealStepDelay(0, 90), 0);
assert.equal(revealStepDelay(1, 90), 90);
assert.notEqual(
  getCardRenderKey({ rank: "A", suit: "h" }, 1),
  getCardRenderKey({ rank: "K", suit: "s" }, 2),
);
for (const rank of ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]) {
  for (const suit of ["h", "d", "c", "s"]) {
    const suitName = { h: "hearts", d: "diamonds", c: "clubs", s: "spades" }[suit];
    assert.ok(existsSync(join(process.cwd(), "public", "cards", `${suitName}_${rank}.png`)));
  }
}
console.log("card visual tests passed");
