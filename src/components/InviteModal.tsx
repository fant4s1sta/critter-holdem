"use client";

import { useState } from "react";
import { InviteQrCode } from "./InviteQrCode";
import { WeChatShareGuide } from "./WeChatShareGuide";

export function InviteModal({
  roomCode,
  onClose,
}: {
  roomCode: string;
  onClose: () => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <>
      <div
        className="px-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        onClick={onClose}
      >
        <div
          className="lobby-panel invite-modal animate-fade-up w-full max-w-sm p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <p
            id="invite-modal-title"
            className="text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
          >
            邀请好友
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
            房间号{" "}
            <span className="tabular-nums tracking-[0.12em] text-[var(--lobby-ink,#4a220c)]">
              {roomCode}
            </span>
          </p>

          <div className="invite-qr-wrap">
            <InviteQrCode roomCode={roomCode} />
          </div>
          <p className="invite-qr-caption">让好友用微信扫一扫加入</p>

          <div className="invite-wechat-block">
            <button
              type="button"
              className="lobby-btn w-full text-sm"
              onClick={() => setGuideOpen(true)}
            >
              查看转发指引
            </button>
          </div>

          <button type="button" className="lobby-btn mt-4 w-full" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {guideOpen ? <WeChatShareGuide onClose={() => setGuideOpen(false)} /> : null}
    </>
  );
}
