import assert from "node:assert/strict";
import {
  computeStageScale,
  DESIGN_WIDTH,
  MIN_STAGE_HEIGHT,
  PHONE_MAX_WIDTH,
} from "./design-stage";

assert.equal(DESIGN_WIDTH, 440);

// Base device renders 1:1.
assert.equal(computeStageScale(440, 956), 1);

// Phones scale purely by width regardless of height.
assert.equal(computeStageScale(390, 844), Math.round((390 / 440) * 10000) / 10000);
assert.equal(computeStageScale(375, 667), computeStageScale(375, 812));
assert.equal(computeStageScale(360, 400), computeStageScale(360, 800));
assert.ok(computeStageScale(430, 932) < 1);
assert.ok(computeStageScale(412, 915) < computeStageScale(430, 932));

// Wide viewports are capped so at least MIN_STAGE_HEIGHT design px stay visible.
const wide = computeStageScale(1440, 900);
assert.ok(wide < 1440 / DESIGN_WIDTH);
assert.equal(wide, Math.round((900 / MIN_STAGE_HEIGHT) * 10000) / 10000);
assert.equal(
  computeStageScale(PHONE_MAX_WIDTH, MIN_STAGE_HEIGHT * 10),
  Math.round((PHONE_MAX_WIDTH / DESIGN_WIDTH) * 10000) / 10000,
);

// Degenerate input falls back to native size.
assert.equal(computeStageScale(0, 0), 1);
assert.equal(computeStageScale(Number.NaN, 800), 1);

console.log("design stage tests passed");
