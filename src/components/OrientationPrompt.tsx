"use client";

import { useEffect, useState } from "react";

const LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 520px)";

export function OrientationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(LANDSCAPE_QUERY);
    const sync = () => setVisible(media.matches);
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="orientation-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="orientation-prompt-title"
    >
      <div className="orientation-prompt-card animate-fade-up">
        <div className="orientation-prompt-phone" aria-hidden>
          <span className="orientation-prompt-phone-body" />
          <span className="orientation-prompt-phone-notch" />
        </div>
        <p id="orientation-prompt-title" className="orientation-prompt-title">
          请旋转手机
        </p>
        <p className="orientation-prompt-hint">竖屏体验更佳</p>
      </div>
    </div>
  );
}
