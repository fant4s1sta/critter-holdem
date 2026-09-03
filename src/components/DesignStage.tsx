"use client";

import { useEffect, type ReactNode } from "react";
import { applyStageScale } from "@/lib/design-stage";

/**
 * Fixed 440px-wide design canvas, uniformly scaled to the viewport width.
 * The initial scale is set by the inline bootstrap in <head>; this keeps it
 * in sync on rotation / window resize.
 */
export function DesignStage({ children }: { children: ReactNode }) {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyStageScale());
    };

    applyStageScale();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  return <div className="design-stage">{children}</div>;
}
