import type { IncomingMessage, ServerResponse } from "node:http";

/** One year; pair with `assetSrc()` so deploys still bust the browser cache. */
export const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

export function staticAssetPathname(url?: string): string {
  if (!url) return "";
  const query = url.indexOf("?");
  return query === -1 ? url : url.slice(0, query);
}

export function isCacheableStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    /\.(?:webp|png|jpe?g|gif|svg|ico|woff2?)$/i.test(pathname)
  );
}

/** Force long-lived cache headers; Next may otherwise set `max-age=0` on `/public`. */
export function bindStaticAssetCache(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (!isCacheableStaticPath(staticAssetPathname(req.url))) return;

  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name, value) => {
    if (String(name).toLowerCase() === "cache-control") {
      return originalSetHeader("Cache-Control", STATIC_ASSET_CACHE_CONTROL);
    }
    return originalSetHeader(name, value);
  }) as ServerResponse["setHeader"];
  originalSetHeader("Cache-Control", STATIC_ASSET_CACHE_CONTROL);
}
