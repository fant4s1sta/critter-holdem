import type { CritterKind } from "./critters";
import type { Session } from "./session";
import type { GameActionPayload, PlayerIdentity, RoomPublicState } from "./types";

type Command =
  | { type: "create"; name: string; critter: CritterKind }
  | { type: "join"; name: string; code: string; critter: CritterKind }
  | ({ type: "resume" } & Session)
  | { type: "select_critter"; critter: CritterKind }
  | { type: "add_bot" | "start" | "leave" }
  | { type: "action"; turn: number; action: GameActionPayload };

type Reply = {
  type: "reply";
  id: number;
  code?: string;
  identity?: PlayerIdentity;
  error?: string;
  errorCode?: string;
};

type ServerMessage = Reply
  | { type: "state"; room: RoomPublicState }
  | { type: "session_ended"; error: string };

export class RoomError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

type Pending = {
  timer: number;
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
};

export class RoomSocket {
  private socket: WebSocket | null = null;
  private pending = new Map<number, Pending>();
  private nextID = 0;

  constructor(
    private readonly handlers: {
      open: () => void;
      close: () => void;
      state: (room: RoomPublicState) => void;
      ended: (error: string) => void;
    },
  ) {}

  connect() {
    if (this.socket) return;
    const url = new URL("/ws", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket === socket) this.handlers.open();
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.rejectPending("连接中断，请重试");
      this.handlers.close();
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      const message = JSON.parse(event.data) as ServerMessage;
      switch (message.type) {
        case "state":
          this.handlers.state(message.room);
          break;
        case "session_ended":
          this.handlers.ended(message.error);
          socket.close();
          break;
        case "reply": {
          const pending = this.pending.get(message.id);
          if (!pending) return;
          window.clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error) pending.reject(new RoomError(message.error, message.errorCode));
          else pending.resolve(message);
          break;
        }
      }
    };
  }

  async request(command: Command): Promise<Reply> {
    const socket = this.socket;
    if (socket?.readyState !== WebSocket.OPEN) throw new RoomError("连接中，请稍后重试");
    const id = ++this.nextID;
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new RoomError("服务器响应超时，正在重新连接"));
        socket.close();
      }, 8000);
      this.pending.set(id, { timer, resolve, reject });
      try {
        socket.send(JSON.stringify({ ...command, id }));
      } catch {
        window.clearTimeout(timer);
        this.pending.delete(id);
        reject(new RoomError("发送失败，请重试"));
      }
    });
  }

  close() {
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.rejectPending("连接已关闭");
  }

  private rejectPending(message: string) {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(new RoomError(message));
    }
    this.pending.clear();
  }
}
