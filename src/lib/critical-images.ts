import { isImagePreloaded, preloadAllAnimalAvatars, preloadImage } from "./animal-display";

export const BRAND_LOGO_WEBP_SRC = "/brand-logo.webp";
export const BRAND_LOGO_PNG_SRC = "/brand-logo.png";
export const CASINO_BACKGROUND_SRC = "/casino-background.jpg";
export const POKER_TABLE_REFERENCE_SRC = "/poker-table-reference.png";

export const CRITICAL_IMAGE_SRCS = [
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
  POKER_TABLE_REFERENCE_SRC,
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

if (typeof window !== "undefined") {
  void preloadCriticalImages();
  void preloadAllAnimalAvatars();
}
