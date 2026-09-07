"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  ITEM_FLIGHT_MS,
  itemFlightPercentPath,
  tableItemSrc,
  type SeatItemFlight,
} from "@/lib/table-items";

function avatarRect(playerId: string): DOMRect | null {
  const escaped = CSS.escape(playerId);
  const el =
    document.querySelector(`[data-seat-avatar="${escaped}"]`) ??
    document.querySelector(
      `[data-seat-player-id="${escaped}"] .px-seat-avatar`,
    ) ??
    document.querySelector(`[data-seat-player-id="${escaped}"]`);
  return el instanceof HTMLElement ? el.getBoundingClientRect() : null;
}

function flightStyle(
  flight: SeatItemFlight,
  layer: HTMLElement,
): CSSProperties | null {
  const from = avatarRect(flight.fromPlayerId);
  const to = avatarRect(flight.targetPlayerId);
  if (!from || !to) return null;
  const frame = layer.getBoundingClientRect();
  if (!(frame.width > 0) || !(frame.height > 0)) return null;
  const path = itemFlightPercentPath(from, to, frame);
  return {
    "--x0": `${path.x0}%`,
    "--y0": `${path.y0}%`,
    "--x1": `${path.x1}%`,
    "--y1": `${path.y1}%`,
    "--size": `${path.size}%`,
    animationDuration: `${ITEM_FLIGHT_MS}ms`,
  } as CSSProperties;
}

function ItemFlight({
  flight,
  layerRef,
}: {
  flight: SeatItemFlight;
  layerRef: RefObject<HTMLDivElement | null>;
}) {
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const { at, fromPlayerId, itemId, targetPlayerId } = flight;

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    setStyle(
      flightStyle({ at, fromPlayerId, itemId, targetPlayerId }, layer),
    );
  }, [at, fromPlayerId, itemId, layerRef, targetPlayerId]);

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

export function ItemFlightLayer({
  flights,
}: {
  flights: readonly SeatItemFlight[];
}) {
  const layerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="item-flight-layer" ref={layerRef} aria-hidden="true">
      {flights.map((flight) => (
        <ItemFlight
          key={`${flight.fromPlayerId}-${flight.targetPlayerId}-${flight.at}`}
          flight={flight}
          layerRef={layerRef}
        />
      ))}
    </div>
  );
}
