import assert from "node:assert/strict";
import { shouldIgnoreOwnSocialEcho } from "./social-echo";

assert.equal(shouldIgnoreOwnSocialEcho("p1", "p1"), true);
assert.equal(shouldIgnoreOwnSocialEcho("p1", "p2"), false);
assert.equal(shouldIgnoreOwnSocialEcho(null, "p1"), false);
assert.equal(shouldIgnoreOwnSocialEcho(undefined, "p1"), false);

console.log("social-echo.test.ts: ok");
