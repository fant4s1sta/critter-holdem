import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameActionPayload, RoomPublicState } from "@/lib/types";
import type { RoomSocket } from "@/lib/socket";
import type { PandaScene } from "@/lib/panda3d/scene";
import { CHIP_VALUES, chipTotal } from "@/lib/chips";
import { CHIP_COLORS, selectedRaise } from "@/lib/panda3d/live-state";
import styles from "./Room3DClient.module.css";

const streets = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌", showdown: "本手结算" };
const emptyCounts = () => CHIP_VALUES.map(() => 0);

function LiveTable({ room }: { room: RoomPublicState }) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<PandaScene | null>(null);
  const latest = useRef(room);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = host.current!;
    const controller = new AbortController();
    const { signal } = controller;
    void import("@/lib/panda3d/scene").then(async ({ createPandaScene }) => {
      if (signal.aborted) return;
      const scene = await createPandaScene(element, latest.current, signal);
      if (signal.aborted) return;
      runtime.current = scene;
      scene.setRoom(latest.current);
      setReady(true);
    }).catch((error: unknown) => {
      if (!signal.aborted) setError(error instanceof Error ? error.message : "3D 牌桌加载失败");
    });
    return () => {
      controller.abort();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current = room;
    runtime.current?.setRoom(room);
  }, [room]);

  return <>
    <div className={styles.scene} ref={host} data-ready={ready} />
    {!ready && <div className={styles.loading} role="status">{error || "正在布置熊猫牌桌…"}</div>}
  </>;
}

type Command = Exclude<Parameters<RoomSocket["request"]>[0], { type: "create" | "join" | "resume" }>;

export function Room3DClient({
  code, room, receivedAt, connected, request, onLeave,
}: {
  code: string;
  room: RoomPublicState | null;
  receivedAt?: number;
  connected: boolean;
  request: (command: Command) => Promise<unknown>;
  onLeave: () => void;
}) {
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now);
  const [selection, setSelection] = useState({ turn: 0, counts: emptyCounts() });
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState<Command["type"] | null>(null);
  const busy = useRef(false);
  const game = room?.game;
  const nextHandAt = game?.nextHandAt;
  const serverNow = room?.serverNow;

  useEffect(() => {
    if (!nextHandAt) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [nextHandAt]);

  const me = room?.players.find(player => player.id === room.you.playerId);
  const turn = game?.turn ?? 0;
  const counts = selection.turn === turn ? selection.counts : emptyCounts();
  const selected = chipTotal(counts);
  const raise = room ? selectedRaise(room, selected) : null;
  const locked = !room?.you.canAct || !connected || !!pending;
  const maxPlayers = room?.maxPlayers ?? 8;
  const host = me?.isHost;
  const actor = room?.players.find(player => player.id === game?.actingPlayerId);
  const clockOffset = serverNow && receivedAt ? serverNow - receivedAt : 0;
  const next = nextHandAt ? Math.max(0, Math.ceil((nextHandAt - Math.max(now, receivedAt ?? 0) - clockOffset) / 1000)) : 0;
  const winners = game?.winners?.map(winner => {
    const name = room?.players.find(player => player.id === winner.playerId)?.name ?? "玩家";
    return `${name} +${winner.amount.toLocaleString()}${winner.handName ? `（${winner.handName}）` : ""}`;
  }).join(" · ");

  let turnText = `${actor?.name ?? "等待玩家"}行动中`;
  if (game?.street === "showdown") turnText = `${winners || "本手结束"}${next ? ` · ${next}秒后下一手` : ""}`;
  else if (room?.you.spectator) turnText = "正在观战";
  else if (me?.chips === 0 && !me.allIn) turnText = "筹码已用完，观战中";
  else if (me?.folded) turnText = "已弃牌，等待下一手";
  else if (room?.you.canAct) turnText = "轮到你";

  function changeCount(index: number, delta: number) {
    setSelection(previous => {
      const nextCounts = previous.turn === turn ? [...previous.counts] : emptyCounts();
      nextCounts[index] = Math.max(0, nextCounts[index] + delta);
      return chipTotal(nextCounts) <= (me?.chips ?? 0) ? { turn, counts: nextCounts } : previous;
    });
  }

  async function submit(command: Command) {
    if (!connected || busy.current) return;
    busy.current = true;
    setPending(command.type);
    setError("");
    try {
      await request(command);
      if (command.type === "leave") onLeave();
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  function action(payload: GameActionPayload) {
    if (!locked && game) void submit({ type: "action", turn: game.turn, action: payload });
  }

  async function invite() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${code}`);
      setCopied(true);
    } catch {
      setError(`邀请码：${code}`);
    }
  }

  return <main className={styles.page}>
    {room && <LiveTable room={room} />}
    <header className={styles.header}>
      <span>房间 {code} · {room?.players.length ?? 0}/{maxPlayers}</span>
      <nav>
        <button onClick={invite}>{copied ? "已复制" : "邀请"}</button>
        <button onClick={() => void submit({ type: "leave" })} disabled={!connected || !!pending}>{pending === "leave" ? "离开中" : "离开"}</button>
      </nav>
    </header>
    <div className={styles.phase}>{game ? `第 ${game.handNumber} 手 · ${streets[game.street]} · 底池 ${game.pot.toLocaleString()}` : "经典德州 · 等待入座"}</div>
    {error && <div className={styles.error} role="alert">{error}<button aria-label="关闭提示" onClick={() => setError("")}>×</button></div>}
    <section className={styles.panel} data-playing={room?.status === "playing"} data-lobby={room?.status === "lobby"} aria-label="玩家操作区">
      {!connected && <p role="status" className={styles.connection}>连接中，暂不能操作…</p>}
      {!room ? <p role="status">正在同步房间…</p> : room.status === "lobby" ? <>
        <div className={styles.lobbyHeader}>
          <span className={styles.lobbyCards} aria-hidden="true"><span>♠︎</span></span>
          <div className={styles.lobbyHeading}>
            <h2>准备开局</h2>
            <p><b>2</b> 人起<span aria-hidden="true"> · </span>初始筹码 <b>1,000</b><span aria-hidden="true"> · </span>盲注 <b>10 / 20</b></p>
          </div>
          <span className={styles.seatCount} role="status"><b>{room.players.length}</b> / {maxPlayers} 人</span>
        </div>
        <ul className={styles.seats} aria-label="牌桌座位">
          {Array.from({ length: maxPlayers }, (_, seat) => {
            const player = room.players.find(entry => entry.seat === seat);
            return <li className={styles.lobbySeat} key={seat} data-occupied={!!player} data-host={!!player?.isHost}>
              <span className={styles.seatIcon} aria-hidden="true">{player ? "🐼" : "·"}</span>
              <div className={styles.seatIdentity}>
                <span className={styles.seatName} title={player?.name}>{player?.name ?? "空位"}</span>
                {player?.isHost && <span className={styles.hostBadge}>房主</span>}
              </div>
            </li>;
          })}
        </ul>
        {host ? <div className={`${styles.playActions} ${styles.lobbyActions}`}>
          <button onClick={() => void submit({ type: "add_bot" })} disabled={!connected || !!pending || room.players.length >= maxPlayers}>
            <span className={styles.actionSymbol} aria-hidden="true">+</span>
            {pending === "add_bot" ? "入座中…" : "添加机器人"}
          </button>
          <button data-emphasis="true" onClick={() => void submit({ type: "start" })} disabled={!connected || !!pending || room.players.length < 2}>
            <span className={styles.startSymbol} aria-hidden="true" />
            {pending === "start" ? "准备中…" : "开始对局"}
          </button>
        </div> : <p className={styles.waiting} role="status">等待房主开始对局</p>}
      </> : room.status === "finished" ? <>
        <strong>本场结束</strong>
        <p>{room.players.filter(player => player.chips > 0).map(player => `${player.name} · ${player.chips.toLocaleString()}`).join("、") || "牌局已结束"}</p>
        <button className={styles.primary} onClick={() => void submit({ type: "leave" })} disabled={!connected || !!pending}>返回大厅</button>
      </> : <>
        <div className={styles.statusRow}>
          <span className={styles.readout}>我的筹码 <b>{me?.chips.toLocaleString() ?? "—"}</b></span>
          <span className={styles.turn} role="status" title={turnText} data-active={!locked}>
            {pending === "action" ? "正在提交…" : turnText}
          </span>
          <span className={styles.readout}>本轮已投 <b>{me?.betThisStreet.toLocaleString() ?? 0}</b></span>
        </div>
        {!room.you.spectator && <>
          <div className={styles.chips}>{CHIP_VALUES.map((value, index) => {
            const full = selected + value > (me?.chips ?? 0);
            return <div className={styles.chipControl} data-selected={counts[index] > 0} key={value}>
              <button
                className={styles.chip}
                style={{ "--chip-color": CHIP_COLORS[index] } as CSSProperties}
                aria-label={`添加 ${value} 筹码`}
                onClick={() => changeCount(index, 1)}
                disabled={locked || full}
              >
                {value}
              </button>
              <div className={styles.stepper}>
                <button aria-label={`减少 ${value} 筹码`} disabled={locked || counts[index] === 0} onClick={() => changeCount(index, -1)}>−</button>
                <output aria-label={`${value} 筹码个数`}>{counts[index]}</output>
                <button aria-label={`增加 ${value} 筹码`} disabled={locked || full} onClick={() => changeCount(index, 1)}>＋</button>
              </div>
            </div>;
          })}</div>
          <div className={styles.playActions}>
            <button className={styles.fold} disabled={locked} onClick={() => action({ type: "fold" })}>弃牌</button>
            <button data-emphasis={!raise} disabled={locked} onClick={() => action({ type: room.you.callAmount > 0 ? "call" : "check" })}>
              {room.you.callAmount > 0 ? <>跟注 <b>{room.you.callAmount.toLocaleString()}</b></> : "过牌"}
            </button>
            <button data-emphasis={!!raise} disabled={locked || !raise} onClick={() => { if (raise) action({ ...raise, chipCounts: counts }); }}>
              {raise?.type === "all-in" ? "确认全下" : game?.currentBet ? "加注" : "下注"}
              {selected > 0 && <> <b>{selected.toLocaleString()}</b></>}
            </button>
          </div>
        </>}
      </>}
    </section>
  </main>;
}
