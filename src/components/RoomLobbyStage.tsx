"use client";

import { useState, type ReactNode } from "react";
import type { SeatItemFlight } from "@/lib/table-items";
import { ItemFlightLayer } from "./ItemFlightLayer";
import { PokerTableSurface } from "./PokerTableSurface";
import { TableSocialOverlayProvider } from "./TableSocialOverlay";

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
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);

  return (
    <TableSocialOverlayProvider overlay={overlay}>
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
        {/* Above footer (hole cards / AI hint) so seat menus stay tappable and visible. */}
        <div className="table-social-overlay" ref={setOverlay} />
      </section>
    </TableSocialOverlayProvider>
  );
}
