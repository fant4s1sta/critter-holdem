"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ITEM_FLIGHT_MS,
  itemFlightPath,
  tableItemSrc,
  type SeatItemFlight,
} from "@/lib/table-items";

function seatRect(playerId: string): DOMRect | null {
  const el = document.querySelector(
    `[data-seat-player-id="${CSS.escape(playerId)}"]`,
  );
  return el instanceof HTMLElement ? el.getBoundingClientRect() : null;
}

function flightStyle(flight: SeatItemFlight): CSSProperties | null {
  const from = seatRect(flight.fromPlayerId);
  const to = seatRect(flight.targetPlayerId);
  if (!from || !to) return null;
  const path = itemFlightPath(from, to);
  const size = Math.max(
    28,
    Math.min(56, Math.round(((from.width + to.width) / 2) * 0.7)),
  );
  return {
    "--x0": `${path.x0}px`,
    "--y0": `${path.y0}px`,
    "--mx": `${path.mx}px`,
    "--my": `${path.my}px`,
    "--x1": `${path.x1}px`,
    "--y1": `${path.y1}px`,
    width: `${size}px`,
    height: `${size}px`,
    marginLeft: `${-size / 2}px`,
    marginTop: `${-size / 2}px`,
    animationDuration: `${ITEM_FLIGHT_MS}ms`,
  } as CSSProperties;
}

function ItemFlight({ flight }: { flight: SeatItemFlight }) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const { at, fromPlayerId, itemId, targetPlayerId } = flight;

  useLayoutEffect(() => {
    setStyle(
      flightStyle({ at, fromPlayerId, itemId, targetPlayerId }),
    );
  }, [at, fromPlayerId, itemId, targetPlayerId]);

  if (!style) return null;

  return (
    <div className="item-flight" style={style}>
      <img
        className="item-flight-art"
        src={tableItemSrc(flight.itemId)}
        alt=""
        draggable={false}
      />
    </div>
  );
}

export function ItemFlightLayer({ flights }: { flights: SeatItemFlight[] }) {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || flights.length === 0) return null;

  return createPortal(
    <div className="item-flight-layer" aria-hidden="true">
      {flights.map((flight) => (
        <ItemFlight
          key={`${flight.fromPlayerId}-${flight.targetPlayerId}-${flight.at}`}
          flight={flight}
        />
      ))}
    </div>,
    document.body,
  );
}
