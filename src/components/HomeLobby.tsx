import { useRef, useState, type FormEvent } from "react";
import { getPreferredName, savePreferredName } from "@/lib/session";
import { normalizeRoomCode } from "@/lib/spa-route";
import styles from "./HomeLobby.module.css";

export function HomeLobby({
  connected, initialJoinCode, notice, enter,
}: {
  connected: boolean;
  initialJoinCode: string | null;
  notice: string;
  enter: (mode: "create" | "join", name: string, code: string) => Promise<void>;
}) {
  const [name, setName] = useState(getPreferredName);
  const [code, setCode] = useState(initialJoinCode ?? "");
  const [mode, setMode] = useState<"create" | "join">(initialJoinCode ? "join" : "create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connected || pending.current || (mode === "join" && code.length !== 6)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    savePreferredName(name.trim());
    try {
      await enter(mode, name, code);
    } catch (error) {
      setError(error instanceof Error ? error.message : "进房失败，请重试");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function chooseMode(next: "create" | "join") {
    setMode(next);
    setError("");
  }

  const joining = mode === "join";
  const actionLabel = joining ? "进入房间" : "开一桌";

  return (
    <main className={styles.lobby}>
      <header className={styles.hero}>
        <img className={styles.cover} src="/panda-lobby-cover.jpg" alt="" width={1100} height={1100} fetchPriority="high" />
        <div className={styles.topBar}>
          <span className={styles.gameMode}><span aria-hidden="true">♠︎</span> 经典德州</span>
          <span className={styles.connection} role="status" data-connected={connected}>
            {connected ? "已连接" : "连接中"}
          </span>
        </div>
        <div className={styles.title}>
          <h1>萌兽德扑</h1>
          <p>2–8 人同桌 <span aria-hidden="true">·</span> 支持机器人</p>
        </div>
      </header>

      <form className={styles.menu} onSubmit={submit}>
        <div className={styles.modes} role="group" aria-label="进房方式">
          <button type="button" aria-pressed={!joining} onClick={() => chooseMode("create")} disabled={busy}>
            创建房间
          </button>
          <button type="button" aria-pressed={joining} onClick={() => chooseMode("join")} disabled={busy}>
            加入房间
          </button>
        </div>

        <label className={styles.field}>
          昵称
          <input autoComplete="nickname" placeholder="怎么称呼你" maxLength={16} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        {joining && (
          <label className={styles.field}>
            房间码
            <input className={styles.roomCode} inputMode="numeric" autoComplete="off" placeholder="输入 6 位房间码" value={code}
              onChange={(event) => setCode(normalizeRoomCode(event.target.value))} />
          </label>
        )}

        {(error || notice) && <p className={styles.error} role="alert">{error || notice}</p>}
        <button className={styles.submit} aria-busy={busy} disabled={!connected || busy || (joining && code.length !== 6)}>
          {busy ? joining ? "正在加入…" : "正在创建…" : actionLabel}
          <span aria-hidden="true">→</span>
        </button>
        <p className={styles.help}>{joining ? "牌局开始后加入即可观战。" : "开桌后，可邀请好友或添加机器人。"}</p>
      </form>
    </main>
  );
}
