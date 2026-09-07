"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  ITEM_FLIGHT_MS,
  itemFlightPath,
  mapViewportRectToElement,
  tableItemSrc,
  type SeatItemFlight,
} from "@/lib/table-items";

function seatRect(playerId: string): DOMRect | null {
  const el = document.querySelector(
    `[data-seat-player-id="${CSS.escape(playerId)}"]`,
  );
  return el instanceof HTMLElement ? el.getBoundingClientRect() : null;
}

function flightStyle(
  flight: SeatItemFlight,
  layer: HTMLElement,
): CSSProperties | null {
  const from = seatRect(flight.fromPlayerId);
  const to = seatRect(flight.targetPlayerId);
  if (!from || !to) return null;
  const frame = layer.getBoundingClientRect();
  if (!(frame.width > 0) || !(frame.height > 0)) return null;
  const mappedFrom = mapViewportRectToElement(
    from,
    frame,
    layer.clientWidth,
    layer.clientHeight,
  );
  const mappedTo = mapViewportRectToElement(
    to,
    frame,
    layer.clientWidth,
    layer.clientHeight,
  );
  const path = itemFlightPath(mappedFrom, mappedTo);
  const size = Math.max(
    28,
    Math.min(56, Math.round(((mappedFrom.width + mappedTo.width) / 2) * 0.7)),
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
