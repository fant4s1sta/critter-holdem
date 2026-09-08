import assert from "node:assert/strict";
import { ASSET_VERSION, assetSrc } from "./asset-src";
import {
  STATIC_ASSET_CACHE_CONTROL,
  bindStaticAssetCache,
  isCacheableStaticPath,
  staticAssetPathname,
} from "./static-asset-cache";

assert.equal(assetSrc("/items/bomb.webp"), `/items/bomb.webp?v=${ASSET_VERSION}`);
assert.equal(
  assetSrc("/brand-logo.webp?x=1"),
  `/brand-logo.webp?x=1&v=${ASSET_VERSION}`,
);
assert.match(STATIC_ASSET_CACHE_CONTROL, /max-age=31536000/);
assert.match(STATIC_ASSET_CACHE_CONTROL, /immutable/);

assert.equal(staticAssetPathname("/avatars/fox.webp?v=dev"), "/avatars/fox.webp");
assert.equal(isCacheableStaticPath("/avatars/fox.webp"), true);
assert.equal(isCacheableStaticPath("/standees/koala.webp"), true);
assert.equal(isCacheableStaticPath("/brand-logo.png"), true);
assert.equal(isCacheableStaticPath("/_next/static/chunks/app.js"), true);
assert.equal(isCacheableStaticPath("/healthz"), false);
assert.equal(isCacheableStaticPath("/room/ABCD"), false);

const cachedHeaders: Record<string, string> = {};
const cachedRes = {
  setHeader(name: string, value: string) {
    cachedHeaders[name] = value;
    return cachedRes;
  },
};
bindStaticAssetCache(
  { url: "/avatars/fox.webp?v=dev" } as never,
  cachedRes as never,
);
cachedRes.setHeader("Cache-Control", "public, max-age=0");
assert.equal(cachedHeaders["Cache-Control"], STATIC_ASSET_CACHE_CONTROL);

const skippedHeaders: Record<string, string> = {};
const skippedRes = {
  setHeader(name: string, value: string) {
    skippedHeaders[name] = value;
    return skippedRes;
  },
};
bindStaticAssetCache({ url: "/healthz" } as never, skippedRes as never);
assert.equal(skippedHeaders["Cache-Control"], undefined);

console.log("asset src / static cache tests passed");
