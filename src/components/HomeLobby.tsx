"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  RULE_MODE_OPTIONS,
  type AnimalId,
  type GameTypeId,
  type PlayerIdentity,
  type RoomPublicState,
  type RuleMode,
} from "@/lib/types";
import { getPreferredName, saveRoomSession, setPreferredName } from "@/lib/session";
import { isRoomMissingError } from "@/lib/room-errors";
import { getSocket } from "@/lib/socket";
import { LobbyAlertModal } from "./LobbyAlertModal";
import { BrandLogo } from "./BrandLogo";
import { CasinoBackdrop } from "./CasinoBackdrop";
import { PxSelect } from "./PxSelect";

type RoomAck = {
  ok: boolean;
  identity?: PlayerIdentity;
  room?: RoomPublicState;
  error?: string;
};

const REQUEST_TIMEOUT_MS = 10_000;

export function HomeLobby({
  onEnterRoom,
  initialJoinCode,
}: {
  onEnterRoom: (code: string, initialRoom?: RoomPublicState) => void;
  /** Pre-fill join tab when opened from an invite link */
  initialJoinCode?: string | null;
}) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  const [gameType] = useState<GameTypeId>("texas-holdem");
  const [ruleMode, setRuleMode] = useState<RuleMode>("classic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roomMissingMessage, setRoomMissingMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "join">(
    initialJoinCode ? "join" : "create",
  );
  const busyRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setName(getPreferredName());
  }, []);

  useEffect(() => {
    if (!initialJoinCode) return;
    setMode("join");
    setJoinCode(initialJoinCode);
  }, [initialJoinCode]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      busyRef.current = false;
    };
  }, []);

  const ruleMeta = useMemo(
    () => RULE_MODE_OPTIONS.find((r) => r.id === ruleMode)!,
    [ruleMode],
  );

  function runRoomRequest(
    failMessage: string,
    emit: (done: (res: RoomAck) => void) => void,
  ) {
    if (busyRef.current) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    busyRef.current = true;
    setError("");
    setRoomMissingMessage(null);
    setBusy(true);
    setPreferredName(name);

    const timeout = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      busyRef.current = false;
      setBusy(false);
      setError("连接超时，请重试");
    }, REQUEST_TIMEOUT_MS);

    emit((res) => {
      if (requestIdRef.current !== requestId) return;
      window.clearTimeout(timeout);
      if (!res.ok || !res.identity || !res.room) {
        busyRef.current = false;
        setBusy(false);
        const message = res.error || failMessage;
        if (isRoomMissingError(message)) {
          setRoomMissingMessage(message);
        } else {
          setError(message);
        }
        return;
      }
      saveRoomSession(res.room.code, res.identity, res.room.ruleMode ?? ruleMode);
      busyRef.current = false;
      setBusy(false);
      onEnterRoom(res.room.code, res.room);
    });
  }

  function createRoom() {
    runRoomRequest("创建失败", (done) => {
      getSocket().emit(
        "create_room",
        { name: name || "玩家", gameType, ruleMode },
        done,
      );
    });
  }

  function joinRoom() {
    if (joinCode.trim().length < 6) return;
    runRoomRequest("加入失败", (done) => {
      getSocket().emit(
        "join_room",
        { code: joinCode.trim(), name: name || "玩家" },
        done,
      );
    });
  }

  return (
    <main className="lobby-page room-shell home-lobby-shell relative">
      <div className="lobby-glow" aria-hidden />
      <CasinoBackdrop />

      <div className="safe-pad home-lobby-content relative z-[1] mx-auto flex w-full max-w-md flex-1 flex-col justify-start">
        <header className="mb-4 animate-fade-up">
          <h1 className="m-0">
            <BrandLogo className="mx-auto block h-auto w-[min(100%,22rem)] select-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.4)]" />
          </h1>
        </header>

        <section className="lobby-panel animate-fade-up delay-1 space-y-3.5 p-4">
          <div className="lobby-tabs" role="tablist" aria-label="进房方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "create"}
              className={`lobby-tab${mode === "create" ? " is-active" : ""}`}
              onClick={() => setMode("create")}
            >
              创建房间
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "join"}
              className={`lobby-tab${mode === "join" ? " is-active" : ""}`}
              onClick={() => setMode("join")}
            >
              加入房间
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="lobby-label">昵称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="怎么称呼你"
              className="lobby-input"
              autoComplete="nickname"
              enterKeyHint="done"
            />
          </label>

          <div className="lobby-field-slot space-y-1.5">
            {mode === "create" ? (
              <>
                <span className="lobby-label">模式</span>
                <PxSelect
                  value={ruleMode}
                  onChange={setRuleMode}
                  options={RULE_MODE_OPTIONS.map((g) => ({
                    value: g.id,
                    label: g.name,
                  }))}
                />
                <p className="lobby-hint">{ruleMeta.description}</p>
              </>
            ) : (
              <label className="block space-y-1.5">
                <span className="lobby-label">房间码</span>
                <input
                  value={joinCode}
                  onChange={(e) =>
                    setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  placeholder="例如 482193"
                  className="lobby-input lobby-input-code"
                  inputMode="numeric"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <p className="lobby-hint" aria-hidden>
                  &nbsp;
                </p>
              </label>
            )}
          </div>

          {error ? (
            <p className="lobby-error text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || (mode === "join" && joinCode.trim().length < 6)}
            aria-busy={busy}
            onClick={() => (mode === "create" ? createRoom() : joinRoom())}
            className={`lobby-cta w-full${busy ? " is-loading" : ""}`}
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="lobby-cta-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                连接中…
              </span>
            ) : mode === "create" ? (
              "开一桌"
            ) : (
              "进入房间"
            )}
          </button>
        </section>
      </div>

      {roomMissingMessage ? (
        <LobbyAlertModal
          title="房间不存在"
          message={roomMissingMessage}
          onClose={() => setRoomMissingMessage(null)}
        />
      ) : null}
    </main>
  );
}
