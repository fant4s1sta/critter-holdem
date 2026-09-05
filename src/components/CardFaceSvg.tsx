import type { Card, Rank, Suit } from "@/lib/types";
import {
  SUIT_COLORS,
  SUIT_LABELS,
  SUIT_PATHS,
  isFaceRank,
  pipLayout,
  rankLabel,
} from "@/lib/card-visuals";

const VB_W = 242;
const VB_H = 340;

function SuitGlyph({
  suit,
  x,
  y,
  size,
  flip = false,
}: {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
}) {
  const scale = size / 100;
  const transform = flip
    ? `translate(${x} ${y}) rotate(180) scale(${scale}) translate(-50 -50)`
    : `translate(${x} ${y}) scale(${scale}) translate(-50 -50)`;
  return (
    <path
      d={SUIT_PATHS[suit]}
      fill={SUIT_COLORS[suit]}
      transform={transform}
    />
  );
}

function CornerIndex({
  rank,
  suit,
  x,
  y,
  flip = false,
}: {
  rank: Rank;
  suit: Suit;
  x: number;
  y: number;
  flip?: boolean;
}) {
  const label = rankLabel(rank);
  const color = SUIT_COLORS[suit];
  const transform = flip
    ? `translate(${x} ${y}) rotate(180)`
    : `translate(${x} ${y})`;
  return (
    <g transform={transform}>
      <text
        x={0}
        y={0}
        fill={color}
        fontSize={rank === "T" ? 28 : 32}
        fontWeight={800}
        fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
        textAnchor="middle"
        dominantBaseline="hanging"
      >
        {label}
      </text>
      <SuitGlyph suit={suit} x={0} y={rank === "T" ? 42 : 40} size={22} />
    </g>
  );
}

function FaceArt({ rank, suit }: { rank: Rank; suit: Suit }) {
  const color = SUIT_COLORS[suit];
  const accent = suit === "h" || suit === "d" ? "#f0a0a4" : "#c8c8c8";
  const half = (
    <g>
      <rect
        x={68}
        y={72}
        width={106}
        height={98}
        rx={10}
        fill={accent}
        stroke={color}
        strokeWidth={3}
      />
      <SuitGlyph suit={suit} x={121} y={108} size={36} />
      <text
        x={121}
        y={148}
        fill={color}
        fontSize={44}
        fontWeight={900}
        fontFamily='ui-sans-serif, system-ui, "Segoe UI", sans-serif'
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {rankLabel(rank)}
      </text>
    </g>
  );

  return (
    <g>
      {half}
      <g transform={`translate(${VB_W} ${VB_H}) rotate(180)`}>{half}</g>
      <line
        x1={78}
        y1={170}
        x2={164}
        y2={170}
        stroke={color}
        strokeWidth={2}
        opacity={0.35}
      />
    </g>
  );
}

export function CardFaceSvg({
  card,
  className,
  dealDelay = 0,
}: {
  card: Card;
  className?: string;
  dealDelay?: number;
}) {
  const label = `${rankLabel(card.rank)} ${SUIT_LABELS[card.suit]}`;
  const pips = isFaceRank(card.rank) ? [] : pipLayout(card.rank);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={VB_W}
      height={VB_H}
      role="img"
      aria-label={label}
      style={dealDelay ? { animationDelay: `${dealDelay}ms` } : undefined}
    >
      <rect
        x={1.5}
        y={1.5}
        width={VB_W - 3}
        height={VB_H - 3}
        rx={16}
        ry={16}
        fill="#fffef8"
        stroke="rgba(40, 18, 6, 0.22)"
        strokeWidth={2}
      />
      <CornerIndex rank={card.rank} suit={card.suit} x={28} y={18} />
      <CornerIndex
        rank={card.rank}
        suit={card.suit}
        x={VB_W - 28}
        y={VB_H - 18}
        flip
      />
      {isFaceRank(card.rank) ? (
        <FaceArt rank={card.rank} suit={card.suit} />
      ) : (
        pips.map((pip, index) => (
          <SuitGlyph
            key={`${pip.x}-${pip.y}-${index}`}
            suit={card.suit}
            x={pip.x}
            y={pip.y}
            size={36 * (pip.scale ?? 1)}
            flip={pip.flip}
          />
        ))
      )}
    </svg>
  );
}
