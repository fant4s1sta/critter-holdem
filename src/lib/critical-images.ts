import { isImagePreloaded, preloadImage } from "./animal-display";
import { assetSrc } from "./asset-src";

export const BRAND_LOGO_WEBP_SRC = assetSrc("/brand-logo.webp");
export const BRAND_LOGO_PNG_SRC = assetSrc("/brand-logo.png");
export const CASINO_BACKGROUND_SRC = assetSrc("/casino-background.webp");
export const POKER_TABLE_REFERENCE_SRC = assetSrc("/poker-table-reference.webp");

/** Brand + home background. Poker table is also in BOOT_ASSET_SRCS. */
export const CRITICAL_IMAGE_SRCS = [
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
] as const;

export function preloadBrandLogo(): Promise<void> {
  return preloadImage(BRAND_LOGO_WEBP_SRC);
}

export function isBrandLogoPreloaded(): boolean {
  return isImagePreloaded(BRAND_LOGO_WEBP_SRC);
}

export function preloadCriticalImages(): Promise<void> {
  return Promise.all(CRITICAL_IMAGE_SRCS.map((src) => preloadImage(src))).then(
    () => undefined,
  );
}

// First-paint asset progress is owned by BootSplash's inline loader.
