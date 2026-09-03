"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildInviteUrl } from "@/lib/invite-url";
import { BrandLogo } from "./BrandLogo";

export function InviteQrCode({ roomCode }: { roomCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = buildInviteUrl(roomCode);

    void QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#1a0f08", light: "#fff8ee" },
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  if (!dataUrl) {
    return (
      <div className="invite-qr invite-qr-placeholder" aria-hidden>
        …
      </div>
    );
  }

  return (
    <div className="invite-qr-frame">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`房间 ${roomCode} 邀请二维码`}
        width={200}
        height={200}
        className="invite-qr"
        draggable={false}
      />
      <span className="invite-qr-logo" aria-hidden="true">
        <BrandLogo />
      </span>
    </div>
  );
}
