import assert from "node:assert/strict";
import { latestCooldownUntil } from "../components/AvatarCooldownRing";

assert.equal(latestCooldownUntil(), 0);
assert.equal(latestCooldownUntil(null, undefined, 0), 0);
assert.equal(latestCooldownUntil(100, 50), 100);
assert.equal(latestCooldownUntil(10, 200, 150), 200);

console.log("avatar-cooldown.test.ts: ok");
