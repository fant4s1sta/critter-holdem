import { POKER_TABLE_REFERENCE_SRC } from "@/lib/critical-images";

export function PokerTableSurface({ className = "" }: { className?: string }) {
  return (
    <div className={`poker-table-surface ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={POKER_TABLE_REFERENCE_SRC}
        alt="赌场荷官与德州扑克桌面"
        className="poker-table-reference-image select-none"
        draggable={false}
      />
    </div>
  );
}
