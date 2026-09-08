"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  PortalToTableSocialOverlay,
  useOverlayAnchorStyle,
} from "./TableSocialOverlay";
import type { EmotePickerPlacement } from "@/lib/seat-layout";

export function AnchoredMenuPortal({
  open,
  placement,
  triggerRef,
  panelRef,
  panelId,
  className,
  label,
  children,
}: {
  open: boolean;
  placement: EmotePickerPlacement;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  panelId: string;
  className: string;
  label: string;
  children: ReactNode;
}) {
  const { overlay, style } = useOverlayAnchorStyle(open, triggerRef);
  if (!open) return null;

  const panel = (
    <div
      id={panelId}
      ref={panelRef}
      className={className}
      role="listbox"
      aria-label={label}
    >
      {children}
    </div>
  );

  // Overlay missing (first paint) — keep menu usable inline under .emote-picker.
  if (!overlay) return panel;

  return (
    <PortalToTableSocialOverlay>
      <div
        className={`emote-picker-portal-anchor is-${placement}`}
        style={style}
      >
        {panel}
      </div>
    </PortalToTableSocialOverlay>
  );
}

export function usePickerMenu(disabled?: boolean) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return {
    open,
    setOpen,
    rootRef,
    triggerRef,
    panelRef,
    panelId,
  };
}
