"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { BRAND_LOGO_PNG_SRC } from "@/lib/critical-images";
import { buildInviteUrl } from "@/lib/invite-url";

const QR_SIZE = 200;
const LOGO_PLATE_W = 58;
const LOGO_PLATE_H = 44;
const LOGO_PAD = 4;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`failed to load ${src}`));
    image.src = src;
  });
}

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Bake the brand logo into the QR PNG so WeChat long-press save keeps it. */
async function buildBrandedInviteQr(roomCode: string): Promise<string> {
  const inviteUrl = buildInviteUrl(roomCode);
  const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: "H",
    color: { dark: "#1a0f08", light: "#fff8ee" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = QR_SIZE;
  canvas.height = QR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return qrDataUrl;

  const qrImage = await loadImage(qrDataUrl);
  ctx.drawImage(qrImage, 0, 0, QR_SIZE, QR_SIZE);

  const plateX = (QR_SIZE - LOGO_PLATE_W) / 2;
  const plateY = (QR_SIZE - LOGO_PLATE_H) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(90, 34, 12, 0.3)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 2;
  fillRoundRect(ctx, plateX, plateY, LOGO_PLATE_W, LOGO_PLATE_H, 8);
  ctx.fillStyle = "#fff8ee";
  ctx.fill();
  ctx.restore();

  fillRoundRect(ctx, plateX, plateY, LOGO_PLATE_W, LOGO_PLATE_H, 8);
  ctx.strokeStyle = "#c45e1c";
  ctx.lineWidth = 2;
  ctx.stroke();

  try {
    const logo = await loadImage(BRAND_LOGO_PNG_SRC);
    const maxW = LOGO_PLATE_W - LOGO_PAD * 2;
    const maxH = LOGO_PLATE_H - LOGO_PAD * 2;
    const aspect = logo.naturalWidth / Math.max(logo.naturalHeight, 1);
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }
    const drawX = plateX + (LOGO_PLATE_W - drawW) / 2;
    const drawY = plateY + (LOGO_PLATE_H - drawH) / 2;
    ctx.drawImage(logo, drawX, drawY, drawW, drawH);
  } catch {
    // Keep the QR even if the logo asset fails; center plate still marks the brand.
  }

  return canvas.toDataURL("image/png");
}

export function InviteQrCode({ roomCode }: { roomCode: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void buildBrandedInviteQr(roomCode)
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
        width={QR_SIZE}
        height={QR_SIZE}
        className="invite-qr"
        draggable={false}
      />
    </div>
  );
}
