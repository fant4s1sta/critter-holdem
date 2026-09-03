"use client";

import { useEffect, useRef, useState } from "react";

export function PotPlaque({
  pot,
  className = "",
}: {
  pot: number;
  className?: string;
}) {
  const prevPot = useRef(pot);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (pot > prevPot.current) {
      setPulse(true);
      const timer = window.setTimeout(() => setPulse(false), 560);
      prevPot.current = pot;
      return () => window.clearTimeout(timer);
    }
    prevPot.current = pot;
  }, [pot]);

  return (
    <div
      className={`pot-plaque${pot > 0 ? " has-pot" : ""}${pulse ? " is-pulse" : ""} ${className}`.trim()}
      aria-label={`底池 ${pot}`}
    >
      <div className="pot-plaque-chips" aria-hidden>
        <span className="pot-chip pot-chip-back" />
        <span className="pot-chip pot-chip-mid" />
        <span className="pot-chip pot-chip-front" />
      </div>

      <div className="pot-plaque-body">
        <span className="pot-plaque-label">底池</span>
        <span className="pot-plaque-value">{pot}</span>
      </div>

      <span className="pot-plaque-shine" aria-hidden />
    </div>
  );
}
