import {
  BOOT_ASSET_SRCS,
  BOOT_PERCENT_ID,
  BOOT_PROGRESS_FILL_ID,
  BOOT_SPLASH_ID,
  BOOT_SPLASH_STYLE,
  BOOT_STATUS_ID,
  buildBootLoaderScript,
} from "@/lib/boot-splash";
import {
  BRAND_LOGO_PNG_SRC,
  BRAND_LOGO_WEBP_SRC,
} from "@/lib/critical-images";

/**
 * Static first-paint loader embedded in the document HTML.
 * Starts asset downloads immediately and shows a live progress bar before
 * React hydrates; AppShell dismisses it once home is ready.
 */
export function BootSplash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_STYLE }} />
      <div
        id={BOOT_SPLASH_ID}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-busy="true"
        aria-label="资源加载中"
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
          <p className="boot-splash-title">萌兽德扑</p>
          <p id={BOOT_STATUS_ID} className="boot-splash-status">
            正在准备资源
          </p>
          <div className="boot-splash-track" aria-hidden>
            <span
              id={BOOT_PROGRESS_FILL_ID}
              className="boot-splash-fill"
            />
          </div>
          <p id={BOOT_PERCENT_ID} className="boot-splash-percent">
            0%
          </p>
        </div>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: buildBootLoaderScript(BOOT_ASSET_SRCS),
        }}
      />
    </>
  );
}
