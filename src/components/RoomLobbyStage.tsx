"use client";

import type { ReactNode } from "react";
import { PokerTableSurface } from "./PokerTableSurface";

export function RoomTableShell({
  boardOverlay,
  tableCenter,
  feltOverlay,
  seats,
  footer,
  isLobby,
}: {
  boardOverlay?: ReactNode;
  tableCenter: ReactNode;
  feltOverlay?: ReactNode;
  seats: ReactNode;
  footer: ReactNode;
  isLobby: boolean;
}) {
  return (
    <section
      className={`lobby-table-shell ${isLobby ? "is-lobby" : "is-game"} relative z-10 px-1`}
    >
      <div className="table-stage table-stage-lobby">
        <div className="table-board reference-table-board">
          {boardOverlay}
          <div className="table-play">
            <div className="table-felt">
              <PokerTableSurface />
            </div>

            <div className="table-center">{tableCenter}</div>

            {feltOverlay}
            {seats}
          </div>
        </div>
      </div>
      {footer}
    </section>
  );
}
