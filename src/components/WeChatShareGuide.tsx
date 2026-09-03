"use client";

/** Points users to WeChat's native ··· → forward flow (no JS-SDK required). */
export function WeChatShareGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="invite-share-guide"
      role="dialog"
      aria-modal="true"
      aria-label="微信转发指引"
      onClick={onClose}
    >
      <div className="invite-share-guide-arrow" aria-hidden>
        ↗
      </div>
      <p className="invite-share-guide-text">
        点击右上角 <strong>···</strong>
        <br />
        选择「转发给朋友」或「分享到群」
      </p>
      <p className="invite-share-guide-hint">好友点开链接即可加入房间</p>
    </div>
  );
}
