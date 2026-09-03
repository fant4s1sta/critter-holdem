"use client";

export function LobbyAlertModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="px-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lobby-alert-title"
      onClick={onClose}
    >
      <div
        className="lobby-panel lobby-alert-modal animate-fade-up w-full max-w-xs p-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="lobby-alert-title"
          className="text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
        >
          {title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--lobby-ink-soft,#7a4a28)]">
          {message}
        </p>
        <button type="button" className="lobby-cta mt-4 w-full" onClick={onClose}>
          知道了
        </button>
      </div>
    </div>
  );
}
