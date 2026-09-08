/**
 * Cache-busting query for `/public` assets. Hashed `/_next/static` files are
 * already immutable; these URLs are not, so each production build gets a new
 * `v` and browsers treat it as a new cache key.
 */
export const ASSET_VERSION =
  process.env.NEXT_PUBLIC_ASSET_VERSION ?? "dev";

export function assetSrc(path: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}v=${ASSET_VERSION}`;
}
