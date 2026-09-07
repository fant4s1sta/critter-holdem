"use client";

import type { ReactNode } from "react";
import type { SeatItemFlight } from "@/lib/table-items";
import { ItemFlightLayer } from "./ItemFlightLayer";
import { PokerTableSurface } from "./PokerTableSurface";

export function RoomTableShell({
  boardOverlay,
  tableCenter,
  feltOverlay,
  seats,
  flights = [],
  footer,
  isLobby,
}: {
  boardOverlay?: ReactNode;
  tableCenter: ReactNode;
  feltOverlay?: ReactNode;
  seats: ReactNode;
  flights?: readonly SeatItemFlight[];
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
            <ItemFlightLayer flights={flights} />
          </div>
        </div>
      </div>
      {footer}
    </section>
  );
}
