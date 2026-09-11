import assert from "node:assert/strict";
import {
  BOOT_ASSET_SRCS,
  LOBBY_BOOT_ASSET_SRCS,
  TABLE_BOOT_ASSET_SRCS,
  buildBootLoaderScript,
} from "./boot-splash";
import {
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
  POKER_TABLE_REFERENCE_SRC,
} from "./critical-images";

assert.deepEqual(
  [...LOBBY_BOOT_ASSET_SRCS],
  [BRAND_LOGO_WEBP_SRC, CASINO_BACKGROUND_SRC],
);

assert.ok(LOBBY_BOOT_ASSET_SRCS.length < BOOT_ASSET_SRCS.length);
assert.ok(TABLE_BOOT_ASSET_SRCS.includes(POKER_TABLE_REFERENCE_SRC));

for (const src of LOBBY_BOOT_ASSET_SRCS) {
  assert.ok(BOOT_ASSET_SRCS.includes(src), `lobby src missing from full set: ${src}`);
}
for (const src of TABLE_BOOT_ASSET_SRCS) {
  assert.ok(BOOT_ASSET_SRCS.includes(src), `table src missing from full set: ${src}`);
}

assert.equal(
  BOOT_ASSET_SRCS.length,
  new Set(BOOT_ASSET_SRCS).size,
  "BOOT_ASSET_SRCS must not contain duplicates",
);

const lobbySet = new Set(LOBBY_BOOT_ASSET_SRCS);
for (const src of TABLE_BOOT_ASSET_SRCS) {
  assert.ok(!lobbySet.has(src), `table src overlaps lobby set: ${src}`);
}

const script = buildBootLoaderScript(LOBBY_BOOT_ASSET_SRCS, TABLE_BOOT_ASSET_SRCS);
assert.match(script, /__BOOT_LOBBY_READY__/);
assert.match(script, /__BOOT_TABLE_READY__/);
assert.match(script, /boot-lobby-ready/);
assert.match(script, /boot-table-ready/);
assert.match(script, /boot-assets-ready/);
// Splash progress should track the short lobby list, not the full table set.
assert.match(script, new RegExp(String(LOBBY_BOOT_ASSET_SRCS.length)));
assert.ok(!script.includes(`"lobbyTotal":${BOOT_ASSET_SRCS.length}`));

console.log("boot-splash.test.ts: ok");
