"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { mapViewportRectToElement } from "@/lib/table-items";

const TableSocialOverlayContext = createContext<HTMLElement | null>(null);

export function TableSocialOverlayProvider({
  overlay,
  children,
}: {
  overlay: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <TableSocialOverlayContext.Provider value={overlay}>
      {children}
    </TableSocialOverlayContext.Provider>
  );
}

export function useTableSocialOverlay() {
  return useContext(TableSocialOverlayContext);
}

/** Anchor a portaled menu to a trigger, in overlay-local design pixels. */
export function useOverlayAnchorStyle(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
) {
  const overlay = useTableSocialOverlay();
  const [style, setStyle] = useState<CSSProperties | undefined>();

  const sync = useCallback(() => {
    const trigger = triggerRef.current;
    if (!open || !overlay || !trigger) {
      setStyle(undefined);
      return;
    }
    const frame = overlay.getBoundingClientRect();
    if (!(frame.width > 0) || !(frame.height > 0)) {
      setStyle(undefined);
      return;
    }
    const local = mapViewportRectToElement(
      trigger.getBoundingClientRect(),
      frame,
      overlay.clientWidth,
      overlay.clientHeight,
    );
    setStyle({
      "--anchor-x": `${local.left}px`,
      "--anchor-y": `${local.top}px`,
      "--anchor-w": `${local.width}px`,
      "--anchor-h": `${local.height}px`,
    } as CSSProperties);
  }, [open, overlay, triggerRef]);

  useLayoutEffect(() => {
    sync();
    if (!open) return;
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [open, sync]);

  return { overlay, style };
}

export function PortalToTableSocialOverlay({
  children,
}: {
  children: ReactNode;
}) {
  const overlay = useTableSocialOverlay();
  if (!overlay) return null;
  return createPortal(children, overlay);
}
