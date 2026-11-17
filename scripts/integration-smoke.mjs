import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const url = new URL("/ws", process.env.TEST_URL ?? "http://localhost:3000");
url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
const clients = [];

async function connect() {
  const ws = new WebSocket(url);
  clients.push(ws);
  let state;
  let id = 0;
  const replies = new Map();
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.type === "state") state = message.room;
    else if (message.type === "reply") replies.set(message.id, message);
  });
  await Promise.race([once(ws, "open", { signal: AbortSignal.timeout(5000) }), once(ws, "error").then(() => { throw new Error("WebSocket connection failed"); })]);
  return {
    ws,
    get state() { return state; },
    async request(type, fields = {}, expectedError) {
      const requestID = ++id;
      ws.send(JSON.stringify({ id: requestID, type, ...fields }));
      const reply = await until(() => replies.get(requestID), `reply to ${type}`);
      replies.delete(requestID);
      if (expectedError) assert.match(reply.error ?? "", expectedError);
      else assert.equal(reply.error, undefined);
      return reply;
    },
    act(type, turn = state.game.turn) {
      return this.request("action", { turn, action: { type } });
    },
  };
}

async function until(predicate, label, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

try {
  const host = await connect();
  await host.request("create", { name: "Invalid", critter: "dragon" }, /角色/);
  const { code, identity: hostID } = await host.request("create", { name: "Host", critter: "fox" });
  const guest = await connect();
  const { identity: guestID } = await guest.request("join", { name: "Guest", code, critter: "fox" });
  assert.ok(guest.state.players.every(player => player.critter === "fox"));
  await guest.request("select_critter", { critter: "dragon" }, /角色/);
  await guest.request("select_critter", { critter: "pig" });
  await until(() => host.state.players.find(player => player.id === guestID.playerId)?.critter === "pig", "role broadcast");
  await guest.request("select_critter", { critter: "fox" });
  await until(() => host.state.players.find(player => player.id === guestID.playerId)?.critter === "fox", "role switched back");
  await guest.request("start", {}, /房主/);
  await host.request("start");
  await until(() => guest.state?.status === "playing", "guest start");
  await guest.request("select_critter", { critter: "panda" }, /准备开局/);
  for (const client of [host, guest]) {
    assert.equal(client.state.players.find(player => player.id === client.state.you.playerId).holeCards.length, 2);
    assert.equal(client.state.players.find(player => player.id !== client.state.you.playerId).holeCards, null);
  }

  const watcher = await connect();
  await watcher.request("join", { code, name: "Watcher" });
  assert.equal(watcher.state.you.spectator, true);
  assert.ok(watcher.state.players.every(player => player.holeCards === null));
  await watcher.request("action", { turn: host.state.game.turn, action: { type: "fold" } }, /牌局/);
  const initialTurn = host.state.game.turn;
  await host.act("call");
  await until(() => guest.state.you.canAct, "guest turn");
  await host.request("action", { turn: initialTurn, action: { type: "fold" } }, /更新/);

  const disconnected = once(guest.ws, "close");
  guest.ws.close();
  await disconnected;
  await until(() => host.state.players.some(player => player.id === guestID.playerId && !player.connected), "guest disconnect");
  await until(() => host.state.players.some(player => player.id === guestID.playerId && player.aiControlled), "AI takeover", 15_000);
  await until(() => host.state.game.turn > initialTurn + 1, "AI action");

  const resumed = await connect();
  await resumed.request("resume", { code, ...guestID, secret: "wrong" }, /身份/);
  await resumed.request("resume", { code, ...guestID });
  assert.equal(resumed.state.players.find(player => player.id === guestID.playerId).critter, "fox");
  assert.equal(resumed.state.players.find(player => player.id === guestID.playerId).aiControlled, false);

  for (let i = 0; i < 10 && host.state.game.street !== "showdown"; i++) {
    const { turn, actingPlayerId } = host.state.game;
    const acting = actingPlayerId === hostID.playerId ? host : resumed;
    await until(() => acting.state?.game.turn === turn && acting.state.you.canAct, "next actor");
    await acting.act(acting.state.you.callAmount ? "call" : "check");
    await until(() => host.state.game.turn > turn, "action broadcast");
  }
  assert.equal(host.state.game.street, "showdown");
  assert.equal(host.state.players.reduce((chips, player) => chips + player.chips, 0), 2000);
  await until(() => host.state.game.handNumber === 2, "second hand", 6500);

  await watcher.request("leave");
  await resumed.request("leave");
  await host.request("leave");

  const solo = await connect();
  await solo.request("create", { name: "Solo" });
  await solo.request("add_bot");
  assert.equal(solo.state.players.filter(player => player.aiControlled).length, 1);
  await solo.request("start");
  assert.equal(solo.state.status, "playing");
  await solo.request("leave");
  console.log("WebSocket integration passed: multiplayer, private cards, spectator, stale actions, AI takeover, resume, settlement, next hand and solo AI.");
} finally {
  for (const ws of clients) ws.close();
}
