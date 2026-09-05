"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FullScreenLoader } from "./FullScreenLoader";
import { HomeLobby } from "./HomeLobby";
import { RoomClient } from "./RoomClient";
import { SkillRoomClient } from "./SkillRoomClient";
import { readRoomCodeFromLocation, replaceRoomUrl } from "@/lib/spa-route";
import {
  clearRoomSession,
  getRoomRuleMode,
  getRoomSession,
  listResumeCandidates,
  type RoomResumeOffer,
} from "@/lib/session";
import { getSocket } from "@/lib/socket";
import {
  dismissBootSplash,
  preloadBootAssetsWithProgress,
  syncBootAssetRegistry,
  waitForBootAssets,
} from "@/lib/boot-splash";
import type { RoomPublicState, RuleMode } from "@/lib/types";

export function AppShell() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [initialRoom, setInitialRoom] = useState<RoomPublicState | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [resume, setResume] = useState<RoomResumeOffer | null>(null);
  const [ready, setReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const homeShellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const finish = () => {
      if (cancelled || settled) return;
      settled = true;
      setAssetsReady(true);
    };

    // Prefer the early HTML inline loader; fall back if it never signals.
    // Always sync the React preload registry so avatars/standees/table paint immediately.
    void waitForBootAssets()
      .then(() => syncBootAssetRegistry())
      .then(finish);
    const timer = window.setTimeout(() => {
      if (window.__BOOT_ASSETS_READY__) return;
      void preloadBootAssetsWithProgress().then(finish);
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useLayoutEffect(() => {
    if (!ready || !assetsReady) return;
    dismissBootSplash();
  }, [ready, assetsReady]);

  useEffect(() => {
    const urlCode = readRoomCodeFromLocation();
    const candidates = listResumeCandidates(urlCode);
    const socket = getSocket();
    let cancelled = false;

    function finishHome() {
      if (cancelled) return;
      replaceRoomUrl(null);
      setResume(null);
      setRoomCode(null);
      setReady(true);
    }

    function finishOffer(offer: RoomResumeOffer) {
      if (cancelled) return;
      setResume(offer);
      setReady(true);
    }

    function finishWithUrlCode() {
      if (cancelled || !urlCode) return;
      replaceRoomUrl(urlCode);
      if (getRoomSession(urlCode)) {
        setRoomCode(urlCode);
        setInviteCode(null);
      } else {
        setInviteCode(urlCode);
        setRoomCode(null);
      }
      setReady(true);
    }

    if (candidates.length === 0) {
      if (urlCode) finishWithUrlCode();
      else setReady(true);
      return;
    }

    const probe = (index: number) => {
      if (cancelled) return;
      if (index >= candidates.length) {
        if (urlCode) finishWithUrlCode();
        else finishHome();
        return;
      }

      const candidate = candidates[index];
      const timeout = window.setTimeout(() => {
        finishOffer({ code: candidate.code, name: candidate.name });
      }, 6000);

      socket.emit(
        "check_room",
        {
          code: candidate.code,
          playerId: candidate.playerId,
          secret: candidate.secret,
        },
        (res: { ok?: boolean }) => {
          window.clearTimeout(timeout);
          if (cancelled) return;
          if (res?.ok) {
            finishOffer({ code: candidate.code, name: candidate.name });
            return;
          }
          clearRoomSession(candidate.code);
          probe(index + 1);
        },
      );
    };

    const start = () => probe(0);
    if (socket.connected) start();
    else {
      socket.once("connect", start);
      socket.connect();
    }

    return () => {
      cancelled = true;
      socket.off("connect", start);
    };
  }, []);

  function enterRoom(code: string, room?: RoomPublicState) {
    setResume(null);
    setInviteCode(null);
    setInitialRoom(room ?? null);
    setRoomCode(code);
    replaceRoomUrl(code);
  }

  function leaveRoom() {
    setRoomCode(null);
    setInitialRoom(null);
    setInviteCode(null);
    replaceRoomUrl(null);
  }

  function acceptResume() {
    if (!resume) return;
    enterRoom(resume.code);
  }

  function declineResume() {
    if (resume) clearRoomSession(resume.code);
    setResume(null);
    setRoomCode(null);
    replaceRoomUrl(null);
  }

  // Keep the HTML boot splash visible — avoid a second React loader flash.
  if (!ready || !assetsReady) {
    return null;
  }

  if (roomCode) {
    return (
      <RoomGate
        code={roomCode}
        initialRoom={initialRoom}
        onLeaveHome={leaveRoom}
      />
    );
  }

  return (
    <div ref={homeShellRef}>
      <HomeLobby onEnterRoom={enterRoom} initialJoinCode={inviteCode} />
      {resume ? (
        <ResumeRoomModal
          offer={resume}
          onAccept={acceptResume}
          onDecline={declineResume}
        />
      ) : null}
    </div>
  );
}

function ResumeRoomModal({
  offer,
  onAccept,
  onDecline,
}: {
  offer: RoomResumeOffer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      className="px-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-room-title"
    >
      <div className="lobby-panel animate-fade-up w-full max-w-sm p-5 text-center">
        <p
          id="resume-room-title"
          className="text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
        >
          恢复对局
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lobby-ink-soft,#7a4a28)]">
          检测到你还在房间里，是否重新进入？
        </p>
        <p className="mt-2 tracking-[0.08em] font-extrabold tabular-nums text-[var(--lobby-ink,#4a220c)]">
          房间 {offer.code}
        </p>
        {offer.name ? (
          <p className="mt-1 text-xs font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
            昵称 {offer.name}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className="lobby-btn w-full" onClick={onDecline}>
            否
          </button>
          <button type="button" className="lobby-cta w-full" onClick={onAccept}>
            是
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Resolve classic vs skill UI without owning the long-lived socket bind.
 * Prefers the ruleMode saved at create/join; falls back to one-shot reconnect.
 */
function RoomGate({
  code,
  initialRoom,
  onLeaveHome,
}: {
  code: string;
  initialRoom: RoomPublicState | null;
  onLeaveHome: () => void;
}) {
  const [ruleMode, setRuleMode] = useState<RuleMode | null>(() =>
    initialRoom?.ruleMode ?? getRoomRuleMode(code),
  );

  useEffect(() => {
    if (ruleMode) return;

    const roomCode = code.toUpperCase();
    const identity = getRoomSession(roomCode);
    if (!identity) {
      setRuleMode("classic");
      return;
    }

    const socket = getSocket();
    let cancelled = false;

    const finish = (mode: RuleMode) => {
      if (!cancelled) setRuleMode(mode);
    };

    const probe = () => {
      socket.emit(
        "reconnect_room",
        {
          code: roomCode,
          playerId: identity.playerId,
          secret: identity.secret,
        },
        (res: { ok: boolean; room?: RoomPublicState }) => {
          finish(res.ok && res.room ? (res.room.ruleMode ?? "classic") : "classic");
        },
      );
    };

    if (socket.connected) probe();
    else {
      const onConnect = () => {
        socket.off("connect", onConnect);
        probe();
      };
      socket.on("connect", onConnect);
      socket.connect();
      return () => {
        cancelled = true;
        socket.off("connect", onConnect);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [code, ruleMode]);

  if (!ruleMode) {
    return <FullScreenLoader label="同步中" />;
  }

  if (ruleMode === "skill") {
    return (
      <SkillRoomClient
        code={code}
        initialRoom={initialRoom}
        onLeaveHome={onLeaveHome}
      />
    );
  }

  return (
    <RoomClient
      code={code}
      initialRoom={initialRoom}
      onLeaveHome={onLeaveHome}
    />
  );
}
