import { BRAND_LOGO_WEBP_SRC } from "@/lib/critical-images";

/**
 * High-priority logo hint only. Full asset progress is owned by the inline
 * boot loader in BootSplash so the progress bar stays accurate.
 */
export function CriticalImagePreload() {
  return (
    <link
      rel="preload"
      href={BRAND_LOGO_WEBP_SRC}
      as="image"
      type="image/webp"
      fetchPriority="high"
    />
  );
}
