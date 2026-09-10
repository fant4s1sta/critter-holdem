"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type PublicPlayer,
  type RoomPublicState,
} from "@/lib/types";
import { AnimalAvatar } from "./AnimalAvatar";
import { BrandLogo } from "./BrandLogo";
import { getAnimalSkill } from "@/lib/skill-catalog";
import { SKILL_ITEM_SRC, preloadImage } from "@/lib/animal-display";
import { getCardRenderKey } from "@/lib/card-visuals";
import { getViewerCallAmount, recomputeViewerYou } from "@/lib/player-action-ui";
import { pickFinalWinners } from "@/lib/final-winners";
import { clearRoomSession, getRoomSession, saveRoomSession } from "@/lib/session";
import { isRoomRevisionConflict } from "@/lib/room-errors";
import { getSocket } from "@/lib/socket";
import { useRoomConnection } from "@/lib/use-room-connection";
import { useAvatarSelection } from "@/lib/use-avatar-selection";
import { useAddBot } from "@/lib/use-add-bot";
import { usePendingAction } from "@/lib/use-pending-action";
import { useStartGame } from "@/lib/use-start-game";
import { serverNow } from "@/lib/server-clock";
import { useTableSocial } from "@/lib/use-table-social";
import { useTurnWinRate } from "@/lib/use-turn-win-rate";
import { EMOTE_COOLDOWN_MS } from "@/lib/emotes";
import { getSeatLayout, emotePickerPlacement, seatBadgeForSeat } from "@/lib/seat-layout";
import { latestCooldownUntil } from "./AvatarCooldownRing";
import { CommunityCards } from "./CommunityCards";
import { DealerSpeech } from "./DealerSpeech";
import { SeatSocialStack } from "./SeatSocialStack";
import { PlayingCard } from "./PlayingCard";
import { PotPlaque } from "./PotPlaque";
import { FullScreenLoader } from "./FullScreenLoader";
import { HandResultModal } from "./HandResultModal";
import { InviteModal } from "./InviteModal";
import { RoomTableShell } from "./RoomLobbyStage";
import { LobbyAnimalPicker } from "./LobbyAnimalPicker";
import { LobbyStandeeShowcase } from "./LobbyStandeeShowcase";
import { CasinoBackdrop } from "./CasinoBackdrop";
import { LobbyAlertModal } from "./LobbyAlertModal";
import { SkillActivateModal } from "./SkillActivateModal";

export function SkillRoomClient({
  code,
  initialRoom = null,
  onLeaveHome,
}: {
  code: string;
  initialRoom?: RoomPublicState | null;
  onLeaveHome: () => void;
}) {
  const roomCode = code.toUpperCase();
  const [room, setRoom] = useState<RoomPublicState | null>(initialRoom);
  const [error, setError] = useState("");
  const [roomConflict, setRoomConflict] = useState(false);
  const [raiseTo, setRaiseTo] = useState(
    () => initialRoom?.you?.minRaiseTo || initialRoom?.you?.callAmount || 0,
  );
  const [now, setNow] = useState(() => serverNow());
  const [identity, setIdentity] =
    useState<ReturnType<typeof getRoomSession>>(null);
  const [ready, setReady] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [dismissedHand, setDismissedHand] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  const onRoomError = useCallback((message: string) => {
    if (isRoomRevisionConflict(message)) {
      setRoomConflict(true);
    } else {
      setError(message);
    }
  }, []);

  useEffect(() => {
    setIdentity(getRoomSession(roomCode));
    setReady(true);
  }, [roomCode]);

  useEffect(() => {
    void preloadImage(SKILL_ITEM_SRC);
  }, []);

  const { setAvatar, applyAvatarOverlay } = useAvatarSelection({
    roomCode,
    identity,
    setIdentity,
    setRoom,
    setError,
    ruleMode: room?.ruleMode,
  });

  const { addBot, addingBot, seatedPlayerCount, canAddBot } = useAddBot({
    roomCode,
    identity,
    room,
    setError: onRoomError,
  });

  const applyState = useCallback((state: RoomPublicState) => {
    const nextState = recomputeViewerYou(applyAvatarOverlay(state));
    setRoom(nextState);
    if (nextState.you) {
      setRaiseTo(nextState.you.minRaiseTo || nextState.you.callAmount || 0);
    }
    setIdentity((prev) => {
      if (!prev) return prev;
      const me = nextState.players.find((p) => p.id === prev.playerId);
      if (!me || me.avatarId === prev.avatarId) return prev;
      const next = { ...prev, avatarId: me.avatarId };
      saveRoomSession(roomCode, next, nextState.ruleMode);
      return next;
    });
  }, [roomCode, applyAvatarOverlay]);

  const onConnError = useCallback((message: string) => {
    onRoomError(message);
  }, [onRoomError]);

  const onStaleRoom = useCallback(() => {
    clearRoomSession(roomCode);
    onLeaveHome();
  }, [onLeaveHome, roomCode]);

  useEffect(() => {
    // Lobby has no turn clock; ticking here re-rendered every chip filter
    // layer 4×/sec and looked like avatar-frame jitter while picking.
    if (room?.status === "lobby") return;
    const t = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(t);
  }, [room?.status]);

  const { bubbles, hits, flights, sendEmote, throwItem, coolingDown, cooldownUntil } =
    useTableSocial({
    enabled: ready && !!identity,
    roomCode,
    identity,
    onError: onRoomError,
  });

  const { emitAction, pendingAction, actionLocked } = usePendingAction({
    roomCode,
    identity,
    room,
    onError: onRoomError,
  });

  const { startGame, starting, canStart } = useStartGame({
    roomCode,
    identity,
    room,
    onError: onRoomError,
  });

  /** Local-only skill cast wipe — never synced to other clients. */
  const [skillCooldownUntil, setSkillCooldownUntil] = useState(0);

  useRoomConnection({
    enabled: ready && !!identity,
    roomCode,
    identity,
    initialRoom,
    onState: applyState,
    onStaleRoom,
    onError: onConnError,
  });

  useEffect(() => {
    if (!ready) return;
    if (!identity) {
      setError("本地没有该房间的身份信息。请从首页加入或创建。");
    }
  }, [identity, ready]);

  function emitSkill(
    payload: {
      targetPlayerId?: string;
      communityIndex?: number;
      raiseTo?: number;
    },
    reportError?: (message: string) => void,
  ) {
    if (!identity) return;
    // Paint the cooldown wipe now (same as emotes/items); roll back on failure.
    const castAt = Date.now();
    setSkillCooldownUntil(castAt + EMOTE_COOLDOWN_MS);
    getSocket().emit(
      "use_skill",
      {
        code: roomCode,
        playerId: identity.playerId,
        secret: identity.secret,
        ...payload,
      },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) {
          setSkillCooldownUntil((current) => (current === castAt + EMOTE_COOLDOWN_MS ? 0 : current));
          reportError?.(res.error || "技能发动失败");
          return;
        }
        const skillId = me?.avatarId ? getAnimalSkill(me.avatarId).skillId : "";
        if (skillId !== "scout") setSkillOpen(false);
      },
    );
  }

  function leave() {
    if (!identity) {
      onLeaveHome();
      return;
    }
    getSocket().emit(
      "leave_room",
      {
        code: roomCode,
        playerId: identity.playerId,
        secret: identity.secret,
      },
      () => {
        clearRoomSession(roomCode);
        onLeaveHome();
      },
    );
  }

  const me = room?.players.find((p) => p.id === identity?.playerId);
  const turnRemain = room?.game?.turnEndsAt
    ? Math.max(0, Math.ceil((room.game.turnEndsAt - now) / 1000))
    : null;
  const nextHandRemain = room?.game?.nextHandAt
    ? Math.max(0, Math.ceil((room.game.nextHandAt - now) / 1000))
    : null;
  const turnWinRate = useTurnWinRate(room, me);

  const seatLayout = useMemo(() => {
    if (!room) return [];
    return getSeatLayout(room.players);
  }, [room]);

  const callAmount = useMemo(
    () => (room ? getViewerCallAmount(room) : 0),
    [room],
  );

  if (!ready) {
    return (
      <div ref={shellRef} className="room-viewport">
        <FullScreenLoader label="加载中" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div ref={shellRef} className="room-viewport">
      <main className="lobby-page room-shell grid place-items-center px-6">
        <div className="lobby-glow" aria-hidden />
        <div className="lobby-panel lobby-error-card relative w-full max-w-sm p-5">
          <BrandLogo className="mx-auto mb-3 block h-auto w-[min(100%,14rem)]" />
          <p className="body">{error}</p>
          <button
            type="button"
            className="lobby-cta mt-5 w-full"
            onClick={onLeaveHome}
          >
            返回首页
          </button>
        </div>
      </main>
      </div>
    );
  }

  if (!room) {
    return (
      <div ref={shellRef} className="room-viewport">
        {error ? (
          <main className="lobby-page room-shell grid place-items-center px-6">
            <div className="lobby-glow" aria-hidden />
            <div className="lobby-panel lobby-error-card relative w-full max-w-sm p-5">
              <BrandLogo className="mx-auto mb-3 block h-auto w-[min(100%,14rem)]" />
              <p className="body">{error}</p>
              <button
                type="button"
                className="lobby-cta mt-5 w-full"
                onClick={onLeaveHome}
              >
                返回首页
              </button>
            </div>
          </main>
        ) : (
          <FullScreenLoader label="同步中" />
        )}
      </div>
    );
  }

  const inLobby = room.status === "lobby";

  const header = (
    <header className="lobby-topbar relative z-10 mx-auto flex w-full max-w-md items-center justify-between gap-3 px-[var(--ui-pad)] pb-1 pt-[max(0.55rem,var(--safe-top))]">
      <div className="lobby-header-stack">
        {inLobby ? (
          <p className="lobby-header-meta lobby-topbar-code" aria-label={`房间 ${roomCode}`}>
            <span>房间号: </span>
            <span className="code">{roomCode}</span>
          </p>
        ) : (
          <PotPlaque pot={room?.game?.pot ?? 0} />
        )}
      </div>
      <div className="lobby-topbar-actions relative z-[1] flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className={`lobby-btn px-3 text-xs${inLobby ? "" : " pointer-events-none invisible"}`}
          aria-hidden={!inLobby}
          tabIndex={inLobby ? 0 : -1}
        >
          邀请
        </button>
        <button
          type="button"
          onClick={leave}
          className="lobby-btn lobby-topbar-leave px-3 text-xs"
        >
          离开
        </button>
      </div>
    </header>
  );

  const errorBanner = error ? (
        <p
          className={`relative z-10 mx-auto w-full max-w-md px-[var(--ui-pad)] text-sm ${inLobby ? "lobby-error font-bold" : "text-[#ffb4a8]"}`}
        >
          {error}
        </p>
  ) : null;

  return (
    <div ref={shellRef} className="room-viewport">
    <main className="lobby-page room-shell relative overflow-hidden">
      <div className="lobby-glow" aria-hidden />
      <CasinoBackdrop />
      {header}
      {errorBanner}

      {inLobby || room.status !== "lobby" ? (
        <RoomTableShell
          isLobby={inLobby}
          flights={flights}
          boardOverlay={
            inLobby ? null : (
              <DealerSpeech
                action={room.game?.lastAction}
                skillEvent={room.you?.skill?.lastSkillEvent}
                actionContext={`${room.game?.handNumber ?? 0}-${room.game?.street ?? ""}`}
              />
            )
          }
          feltOverlay={
            inLobby && !room.you?.spectator ? (
              <LobbyStandeeShowcase
                avatarId={me?.avatarId ?? null}
                ruleMode={room.ruleMode}
              />
            ) : null
          }
          tableCenter={
            inLobby ? (
              <p className="lobby-table-center">
                {me?.isHost
                  ? `${seatedPlayerCount}/${room.maxPlayers} 人已入座`
                  : "等待房主开始…"}
              </p>
            ) : (
              <CommunityCards
                cards={room.game?.communityCards ?? []}
                handNumber={room.game?.handNumber ?? 0}
              />
            )
          }
          seats={seatLayout.map(({ player, x, y, cupIndex }) => {
            const emote = bubbles[player.id];
            const itemHit = hits[player.id];
            const pickerPlacement = emotePickerPlacement(cupIndex);
            const canUseSocial = Boolean(me && !room.you?.spectator);
            const selfCooldownUntil =
              player.id === me?.id
                ? latestCooldownUntil(cooldownUntil, skillCooldownUntil)
                : 0;
            if (inLobby) {
              return (
                <div
                  key={player.id}
                  className="absolute z-[2] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div className="relative flex flex-col items-center">
                    <SeatSocialStack
                      playerId={player.id}
                      canUseSocial={canUseSocial}
                      isSelf={player.id === me?.id}
                      coolingDown={coolingDown}
                      cooldownUntil={selfCooldownUntil}
                      placement={pickerPlacement}
                      emote={emote}
                      itemHit={itemHit}
                      onSendEmote={sendEmote}
                      onThrowItem={(itemId) => throwItem(player.id, itemId)}
                      avatarClassName={`px-seat-avatar${
                        player.id === me?.id ? " px-seat-active" : ""
                      }${player.connected ? "" : " opacity-55"}`}
                      name={player.name}
                      badge={
                        player.isHost ? (
                          <span className="px-seat-blind is-host">房主</span>
                        ) : null
                      }
                    >
                      <AnimalAvatar id={player.avatarId} size="fill" priority="high" />
                    </SeatSocialStack>
                    <p className="px-seat-name">{player.name}</p>
                    <p className="px-seat-chips lobby-seat-meta">
                      {player.aiControlled
                        ? "AI"
                        : player.connected
                          ? "已入座"
                          : "离线"}
                    </p>
                  </div>
                </div>
              );
            }

            const isActing = room.game?.actingPlayerId === player.id;
            const winner = room.game?.winners?.find(
              (w) => w.playerId === player.id,
            );
            const seatBadge = seatBadgeForSeat(player.seat, room.game);
            return (
              <div
                key={player.id}
                className="absolute z-[2] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="relative flex flex-col items-center">
                  <SeatSocialStack
                    playerId={player.id}
                    canUseSocial={canUseSocial}
                    isSelf={player.id === me?.id}
                    coolingDown={coolingDown}
                    cooldownUntil={selfCooldownUntil}
                    placement={pickerPlacement}
                    emote={emote}
                    itemHit={itemHit}
                    onSendEmote={sendEmote}
                    onThrowItem={(itemId) => throwItem(player.id, itemId)}
                    avatarClassName={`px-seat-avatar ${
                      isActing ? "px-seat-active" : ""
                    } ${
                      winner && room.game?.street === "showdown"
                        ? "px-seat-winner"
                        : ""
                    } ${player.folded ? "opacity-45" : ""}`}
                    name={player.name}
                    badge={
                      seatBadge ? (
                        <span
                          className={`px-seat-blind ${seatBadge.tone === "bb" ? "is-bb" : ""}`}
                        >
                          {seatBadge.label}
                        </span>
                      ) : null
                    }
                  >
                    <AnimalAvatar
                      id={player.avatarId}
                      size="fill"
                      priority="high"
                      eliminated={
                        player.chips <= 0 &&
                        !player.allIn &&
                        (player.holeCardCount ?? 0) === 0
                      }
                    />
                  </SeatSocialStack>
                  <p className="px-seat-name">{player.name}</p>
                  <p className="px-seat-chips">{player.chips}</p>
                </div>
              </div>
            );
          })}
          footer={
            inLobby ? (
              <div className="lobby-table-footer mx-auto w-full max-w-md px-[var(--ui-pad)] pt-1">
                {!room.you?.spectator ? (
                  <div className="lobby-avatar-picker">
                    <LobbyAnimalPicker
                      avatarId={me?.avatarId ?? null}
                      onSelect={setAvatar}
                    />
                  </div>
                ) : (
                  <p className="lobby-wait text-center">观战模式 · 等待房主开始</p>
                )}

                {me?.isHost ? (
                  <div className="mt-2 grid grid-cols-[1fr_1.35fr] gap-2">
                    <button
                      type="button"
                      onClick={addBot}
                      disabled={!canAddBot}
                      className="lobby-btn text-sm"
                    >
                      {addingBot ? "添加中…" : "添加 AI"}
                    </button>
                    <button
                      type="button"
                      onClick={startGame}
                      disabled={!canStart}
                      className="lobby-cta text-sm"
                    >
                      {starting ? "开始中…" : "开始对局"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="game-footer mx-auto w-full max-w-md px-[var(--ui-pad)] pt-1">
                <div className="hole-cards-slot">
                  {me?.holeCards && me.holeCards.length > 0 ? (
                    <div className="hole-cards-row">
                      <div className="hole-cards-cluster">
                        <div className="hole-cards-stack flex items-center gap-1.5">
                          {me.holeCards.map((card, index) => (
                            <PlayingCard
                              key={getCardRenderKey(card, room.game?.handNumber ?? 0)}
                              card={card}
                              dealDelay={index * 60}
                            />
                          ))}
                        </div>
                        {me.avatarId && getAnimalSkill(me.avatarId).kind === "active" ? (
                          <button
                            type="button"
                            className="skill-cast-btn"
                            disabled={!room.you?.skill || room.you.spectator || !!me.folded}
                            title={
                              room.you?.skill?.disabledReason ||
                              `发动${getAnimalSkill(me.avatarId).name}`
                            }
                            aria-label="发动技能"
                            onClick={() => setSkillOpen(true)}
                          >
                            <img
                              src={SKILL_ITEM_SRC}
                              alt=""
                              className="skill-cast-btn-img"
                              draggable={false}
                              decoding="async"
                            />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : me && !room.you?.spectator ? (
                    <p className="hole-cards-empty">
                      {me.chips <= 0 ? "已淘汰" : "等待发牌"}
                    </p>
                  ) : null}
                </div>
                {(() => {
                  let statusText: string | null = null;
                  let statusMuted = false;
                  if (nextHandRemain != null) {
                    statusText = `下一轮 · ${nextHandRemain}秒`;
                  } else if (room.you?.spectator || me?.away) {
                    statusText = null;
                  } else if (pendingAction) {
                    statusText = "已提交，等待服务器…";
                    statusMuted = true;
                  } else if (room.you?.canAct) {
                    statusText = `轮到你${turnRemain != null ? ` · ${turnRemain}秒` : ""}${
                      turnWinRate != null ? ` · 参考胜率 ${turnWinRate}%` : ""
                    }`;
                  } else {
                    statusText = "等待其他玩家";
                    statusMuted = true;
                  }
                  if (!statusText) return null;
                  return (
                    <p
                      className={`game-status mb-2 px-2 text-sm leading-tight${
                        statusMuted ? " is-muted" : ""
                      }`}
                    >
                      {statusText}
                    </p>
                  );
                })()}

                {room.you?.spectator ? (
                  <p className="game-banner">
                    观战模式 · 你可以看到所有玩家的底牌，但不能操作。
                  </p>
                ) : me?.away ? (
                  <p className="game-banner">
                    你已离线，AI 正在代打。保持此页打开即可收回控制权。
                  </p>
                ) : (
                  <div className="game-action-panel space-y-2 p-2.5">
                    <label className="game-range-label">
                      <span>下注 {raiseTo}</span>
                      <input
                        type="range"
                        disabled={actionLocked}
                        min={room.you?.minRaiseTo ?? 0}
                        max={Math.max(
                          room.you?.minRaiseTo ?? 0,
                          room.you?.maxRaiseTo ?? 0,
                        )}
                        value={Math.min(
                          Math.max(raiseTo, room.you?.minRaiseTo ?? 0),
                          room.you?.maxRaiseTo ?? 0,
                        )}
                        onChange={(e) => setRaiseTo(Number(e.target.value))}
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        disabled={actionLocked}
                        className="lobby-btn-danger lobby-btn-sm"
                        onClick={() => emitAction({ type: "fold" })}
                      >
                        弃牌
                      </button>
                      {callAmount > 0 ? (
                        <button
                          type="button"
                          disabled={actionLocked}
                          className="lobby-btn lobby-btn-sm"
                          onClick={() => emitAction({ type: "call" })}
                        >
                          跟{callAmount}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionLocked}
                          className="lobby-btn lobby-btn-sm"
                          onClick={() => emitAction({ type: "check" })}
                        >
                          过牌
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actionLocked}
                        className="lobby-cta lobby-btn-sm"
                        onClick={() =>
                          emitAction({
                            type: callAmount > 0 ? "raise" : "bet",
                            amount: raiseTo,
                          })
                        }
                      >
                        {callAmount > 0 ? "加注" : "下注"}
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={actionLocked}
                      className="lobby-btn-allin lobby-btn-sm w-full"
                      onClick={() => emitAction({ type: "all-in" })}
                    >
                      全下 {room.you?.maxRaiseTo ?? 0}
                    </button>
                  </div>
                )}
              </div>
            )
          }
        />
      ) : null}
    </main>

      {room?.status === "playing" &&
      room.game?.street === "showdown" &&
      room.game.handSummary &&
      room.game.handSummary.length > 0 &&
      dismissedHand !== room.game.handNumber ? (
        <HandResultModal
          game={room.game}
          players={room.players}
          onClose={() => setDismissedHand(room.game!.handNumber)}
        />
      ) : null}

      {room?.status === "finished" ? (
        <GameOverModal
          winners={pickFinalWinners(room.players)}
          isHost={!!me?.isHost}
          onPlayAgain={startGame}
          onLeave={leave}
        />
      ) : null}

      {skillOpen && me?.avatarId && room?.you?.skill ? (
        <SkillActivateModal
          open={skillOpen}
          onClose={() => setSkillOpen(false)}
          animalId={me.avatarId}
          room={room}
          meId={me.id}
          skillState={room.you.skill}
          raiseTo={raiseTo}
          onConfirm={emitSkill}
        />
      ) : null}

      {roomConflict ? (
        <LobbyAlertModal
          title="房间正在同步"
          message="房间状态刚刚发生变化，请稍后再试。"
          onClose={() => setRoomConflict(false)}
        />
      ) : null}

      {inviteOpen ? (
        <InviteModal roomCode={roomCode} onClose={() => setInviteOpen(false)} />
      ) : null}
    </div>
  );
}

function GameOverModal({
  winners,
  isHost,
  onPlayAgain,
  onLeave,
}: {
  winners: PublicPlayer[];
  isHost: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}) {
  const tied = winners.length > 1;
  return (
    <div
      className="px-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div className="lobby-panel animate-fade-up w-full max-w-sm p-5 text-center">
        <p
          id="game-over-title"
          className="text-base font-extrabold text-[var(--lobby-ink,#4a220c)]"
        >
          {tied ? "平局" : "最终赢家"}
        </p>
        <ul className="mt-4 space-y-3">
          {winners.map((winner) => (
            <li key={winner.id}>
              <AnimalAvatar id={winner.avatarId} size="lg" />
              <p className="mt-1 truncate text-lg font-extrabold text-[var(--lobby-ink,#4a220c)]">
                {winner.name}
              </p>
              <p className="text-base font-extrabold tabular-nums text-[var(--lobby-wood-deep,#8f3c10)]">
                {winner.chips}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-2">
          {isHost ? (
            <button
              type="button"
              className="lobby-cta w-full"
              onClick={onPlayAgain}
            >
              再来一局
            </button>
          ) : (
            <p className="text-sm font-semibold text-[var(--lobby-ink-soft,#7a4a28)]">
              等待房主再开一局…
            </p>
          )}
          <button type="button" className="lobby-btn w-full" onClick={onLeave}>
            离开
          </button>
        </div>
      </div>
    </div>
  );
}
