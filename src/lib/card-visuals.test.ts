import assert from "node:assert/strict";
import {
  FACE_CARD_ANIMAL,
  SUIT_COLORS,
  SUIT_LABELS,
  SUIT_PATHS,
  faceCardAnimal,
  getCardRenderKey,
  isFaceRank,
  pipLayout,
  rankLabel,
  revealStepDelay,
} from "./card-visuals";

assert.deepEqual(Object.keys(SUIT_LABELS).sort(), ["c", "d", "h", "s"]);
assert.equal(SUIT_LABELS.s, "黑桃");
assert.equal(SUIT_LABELS.h, "红心");
assert.equal(SUIT_LABELS.d, "方块");
assert.equal(SUIT_LABELS.c, "梅花");
assert.equal(rankLabel("T"), "10");
assert.equal(rankLabel("A"), "A");
assert.equal(SUIT_COLORS.h, SUIT_COLORS.d);
assert.equal(SUIT_COLORS.s, SUIT_COLORS.c);
assert.ok(SUIT_PATHS.s.length > 10);
assert.ok(SUIT_PATHS.h.length > 10);
assert.ok(SUIT_PATHS.d.length > 10);
assert.ok(SUIT_PATHS.c.length > 10);
assert.equal(revealStepDelay(0, 90), 0);
assert.equal(revealStepDelay(1, 90), 90);
assert.notEqual(
  getCardRenderKey({ rank: "A", suit: "h" }, 1),
  getCardRenderKey({ rank: "K", suit: "s" }, 2),
);
assert.equal(pipLayout("A").length, 1);
assert.equal(pipLayout("2").length, 2);
assert.equal(pipLayout("7").length, 7);
assert.equal(pipLayout("T").length, 10);
assert.equal(pipLayout("J").length, 0);
assert.equal(isFaceRank("Q"), true);
assert.equal(isFaceRank("9"), false);
assert.equal(FACE_CARD_ANIMAL.J, "cat");
assert.equal(FACE_CARD_ANIMAL.Q, "rabbit");
assert.equal(FACE_CARD_ANIMAL.K, "fox");
assert.equal(faceCardAnimal("J"), "cat");
assert.equal(faceCardAnimal("A"), null);
console.log("card visual tests passed");
