import {
  BOOT_SPLASH_ID,
  BOOT_SPLASH_STYLE,
} from "@/lib/boot-splash";
import {
  BRAND_LOGO_PNG_SRC,
  BRAND_LOGO_WEBP_SRC,
} from "@/lib/critical-images";

/**
 * Static first-paint loader embedded in the document HTML.
 * Shows before the JS / CSS bundles arrive; AppShell dismisses it when ready.
 */
export function BootSplash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_STYLE }} />
      <div
        id={BOOT_SPLASH_ID}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="加载中"
      >
        <div className="boot-splash-inner">
          <div className="boot-splash-spinner" aria-hidden>
            <span className="boot-splash-ring" />
            <picture className="boot-splash-logo">
              <source srcSet={BRAND_LOGO_WEBP_SRC} type="image/webp" />
              <img
                src={BRAND_LOGO_PNG_SRC}
                alt=""
                width={1100}
                height={782}
                draggable={false}
                decoding="async"
                fetchPriority="high"
              />
            </picture>
          </div>
          <p className="boot-splash-label">加载中</p>
        </div>
      </div>
    </>
  );
}
