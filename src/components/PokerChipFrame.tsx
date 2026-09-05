/** Decorative casino-chip rim. The center stays empty for the avatar. */
export function PokerChipFrame({
  id,
  color,
  selected = false,
}: {
  id: string;
  color: string;
  selected?: boolean;
}) {
  const shine = `chip-shine-${id}`;
  const rim = `chip-rim-${id}`;

  return (
    <svg
      className="lobby-chip-svg"
      viewBox="0 0 100 100"
      aria-hidden
    >
      <defs>
        <radialGradient id={shine} cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
        <linearGradient id={rim} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#fff8dc" />
          <stop offset="45%" stopColor="#e8c878" />
          <stop offset="100%" stopColor="#9a6a18" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="49" fill="#3a1808" />
      <circle cx="50" cy="50" r="47.2" fill={color} />
      <circle cx="50" cy="50" r="47.2" fill={`url(#${shine})`} />

      <circle
        cx="50"
        cy="50"
        r="43.4"
        fill="none"
        stroke="#fff6d4"
        strokeWidth="6.8"
        strokeDasharray="9.4 24.68"
        transform="rotate(-6.2 50 50)"
      />
      <circle
        cx="50"
        cy="50"
        r="43.4"
        fill="none"
        stroke="#2a1208"
        strokeOpacity="0.22"
        strokeWidth="6.8"
        strokeDasharray="9.4 24.68"
        transform="rotate(-6.2 50 50)"
      />

      {/* Selection only restyles the inner gold rim (same radius + width)
          so the chip outer diameter never changes. */}
      <circle
        cx="50"
        cy="50"
        r="38.4"
        fill="none"
        stroke={selected ? `url(#${rim})` : "#f0d48a"}
        strokeWidth="2.1"
      />
      <circle cx="50" cy="50" r="36.6" fill="none" stroke="#6b2a0c" strokeWidth="0.9" />
    </svg>
  );
}
