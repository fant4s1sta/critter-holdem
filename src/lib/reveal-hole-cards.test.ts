import assert from "node:assert/strict";
import { shouldRevealHoleCards } from "./reveal-hole-cards";

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: true,
      isSpectator: false,
      street: "preflop",
      folded: false,
      contenderCount: 2,
    }),
    true,
  );
}

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: false,
      isSpectator: false,
      street: "preflop",
      folded: false,
      contenderCount: 2,
    }),
    false,
  );
}

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: false,
      isSpectator: false,
      street: "showdown",
      folded: false,
      contenderCount: 2,
    }),
    true,
  );
}

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: false,
      isSpectator: false,
      street: "showdown",
      folded: true,
      contenderCount: 1,
    }),
    false,
  );
}

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: false,
      isSpectator: false,
      street: "showdown",
      folded: false,
      contenderCount: 1,
    }),
    false,
  );
}

{
  assert.equal(
    shouldRevealHoleCards({
      hasHoleCards: true,
      isViewer: false,
      isSpectator: true,
      street: "flop",
      folded: true,
      contenderCount: 3,
    }),
    true,
  );
}

console.log("reveal hole cards tests passed");
