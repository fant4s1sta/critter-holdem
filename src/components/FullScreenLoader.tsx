"use client";

import {
  BRAND_LOGO_PNG_SRC,
  BRAND_LOGO_WEBP_SRC,
} from "@/lib/critical-images";

export function FullScreenLoader({
  label = "加载中",
}: {
  label?: string;
}) {
  return (
    <main
      className="lobby-page fullscreen-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="lobby-glow" aria-hidden />
      <div className="fullscreen-loader-content">
        <div className="fullscreen-loader-spinner" aria-hidden>
          <span className="fullscreen-loader-ring" />
          <picture className="fullscreen-loader-logo">
            <source srcSet={BRAND_LOGO_WEBP_SRC} type="image/webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_PNG_SRC}
              alt=""
              width={1100}
              height={782}
              className="fullscreen-loader-logo-img"
              draggable={false}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
        </div>
        <p className="fullscreen-loader-label">{label}</p>
      </div>
    </main>
  );
}
