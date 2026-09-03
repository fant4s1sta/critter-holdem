"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

function attachSocketDebug(activeSocket: Socket) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const debug =
    params.has("socketDebug") || process.env.NODE_ENV === "development";
  if (!debug) return;

  activeSocket.on("connect", () => {
    console.info(
      "[socket] connected via",
      activeSocket.io.engine.transport.name,
    );
  });

  const engine = activeSocket.io.engine;
  engine.on("upgrade", () => {
    console.info("[socket] transport upgraded:", engine.transport.name);
  });

  activeSocket.io.on("reconnect", () => {
    console.info(
      "[socket] reconnected via",
      activeSocket.io.engine.transport.name,
    );
  });
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      // Prefer WebSocket on remote hosts — default polling-first adds RTT on mobile.
      transports: ["websocket", "polling"],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10_000,
    });
    attachSocketDebug(socket);
  }
  return socket;
}
