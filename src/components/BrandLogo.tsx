"use client";

import { useEffect, useState } from "react";
import {
  BRAND_LOGO_PNG_SRC,
  BRAND_LOGO_WEBP_SRC,
  isBrandLogoPreloaded,
  preloadBrandLogo,
} from "@/lib/critical-images";

export function BrandLogo({
  className = "",
  variant = "default",
  alt = "CRITTER HOLD'EM 萌兽德扑",
}: {
  className?: string;
  variant?: "default" | "card-back";
  alt?: string;
}) {
  const [ready, setReady] = useState(() => isBrandLogoPreloaded());
  const baseClass = variant === "card-back" ? "card-back-logo" : "brand-logo";
  const imgClass = `${baseClass}${ready ? " is-ready" : ""} ${className}`.trim();

  useEffect(() => {
    if (isBrandLogoPreloaded()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void preloadBrandLogo().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <picture className="brand-logo-frame">
      <source srcSet={BRAND_LOGO_WEBP_SRC} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_LOGO_PNG_SRC}
        alt={variant === "card-back" ? "" : alt}
        width={1100}
        height={782}
        className={imgClass}
        draggable={false}
        decoding="async"
        fetchPriority="high"
        aria-hidden={variant === "card-back" ? true : undefined}
      />
    </picture>
  );
}
