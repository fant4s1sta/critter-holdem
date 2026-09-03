import assert from "node:assert/strict";
import { RoomManager } from "./room-manager";
import type { GameActionPayload, PlayerIdentity, PublicPlayer } from "../src/lib/types";
import { pickFinalWinners } from "../src/lib/final-winners";

function manager() {
  return new RoomManager(() => undefined);
}

{
  const rooms = manager();
  const created = rooms.createRoom({
    name: "主持人",
    avatarId: "cat",
  } as never);
  assert.match(created.room.code, /^\d{6}$/);

  for (let i = 1; i < 10; i += 1) {
    rooms.joinRoom({
      code: created.room.code,
      name: `玩家${i}`,
      avatarId: "dog",
    } as never);
  }

  assert.equal(
    rooms.getPublicState(created.room.code, created.identity.playerId)?.players
      .length,
    10,
  );
  assert.throws(
    () =>
      rooms.joinRoom({
        code: created.room.code,
        name: "第11人",
      } as never),
    /房间已满/,
  );
}

{
  const rooms = manager();
  const created = rooms.createRoom({
    name: "房主",
    aiCount: 5,
  });
  const state = rooms.getPublicState(
    created.room.code,
    created.identity.playerId,
  )!;
  assert.equal(state.players.length, 6);
  assert.equal(state.players.filter((p) => p.aiControlled).length, 5);
  const botAvatars = state.players
    .filter((p) => p.aiControlled)
    .map((p) => p.avatarId);
  assert.equal(new Set(botAvatars).size, botAvatars.length);
  assert.equal(
    state.players.some((p) => p.name.startsWith("AI-")),
    false,
  );
}

{
  const rooms = manager();
  const created = rooms.createRoom({
    name: "房主",
    avatarId: "rabbit",
  } as never);
  rooms.joinRoom({
    code: created.room.code,
    name: "玩家",
    avatarId: "fox",
  } as never);
  rooms.startGame(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
  );

  const spectator = rooms.joinRoom({
    code: created.room.code,
    name: "观众",
    avatarId: "bear",
  } as never);
  assert.equal(spectator.spectator, true);
}

{
  const rooms = manager();
  const host = rooms.createRoom({
    name: "房主",
    avatarId: "rabbit",
  } as never);
  const guest = rooms.joinRoom({
    code: host.room.code,
    name: "玩家",
    avatarId: "fox",
  } as never);
  rooms.startGame(
    host.room.code,
    host.identity.playerId,
    host.identity.secret,
  );

  const preflop = rooms.getPublicState(
    host.room.code,
    host.identity.playerId,
  )!;
  const opponentPreflop = preflop.players.find(
    (p) => p.id === guest.identity.playerId,
  );
  assert.equal(preflop.game?.street, "preflop");
  assert.equal(opponentPreflop?.holeCards, null);
  assert.ok((opponentPreflop?.holeCardCount ?? 0) > 0);

  playToShowdown(rooms, host.room.code, [host.identity, guest.identity]);
  const showdown = rooms.getPublicState(
    host.room.code,
    host.identity.playerId,
  )!;
  assert.equal(showdown.game?.street, "showdown");
  const opponentShowdown = showdown.players.find(
    (p) => p.id === guest.identity.playerId,
  )!;
  const selfShowdown = showdown.players.find(
    (p) => p.id === host.identity.playerId,
  )!;
  if (!opponentShowdown.folded && !selfShowdown.folded) {
    assert.ok(opponentShowdown.holeCards && opponentShowdown.holeCards.length === 2);
    assert.ok(selfShowdown.holeCards && selfShowdown.holeCards.length === 2);
  } else {
    assert.equal(opponentShowdown.holeCards, null);
  }
}

{
  const rooms = manager();
  const host = rooms.createRoom({
    name: "房主",
    avatarId: "cat",
  } as never);
  rooms.joinRoom({
    code: host.room.code,
    name: "玩家",
    avatarId: "dog",
  } as never);
  rooms.startGame(
    host.room.code,
    host.identity.playerId,
    host.identity.secret,
  );
  const spectator = rooms.joinRoom({
    code: host.room.code,
    name: "观众",
    avatarId: "bear",
  } as never);
  const specState = rooms.getPublicState(
    host.room.code,
    spectator.identity.playerId,
  )!;
  assert.equal(specState.you?.spectator, true);
  assert.ok(
    specState.players.every((p) => (p.holeCards?.length ?? 0) === 2),
  );
}

{
  const rooms = manager();
  const host = rooms.createRoom({
    name: "房主",
    avatarId: "mouse",
  } as never);
  const guest = rooms.joinRoom({
    code: host.room.code,
    name: "玩家",
    avatarId: "fox",
  } as never);
  rooms.startGame(
    host.room.code,
    host.identity.playerId,
    host.identity.secret,
  );
  const start = rooms.getPublicState(host.room.code, host.identity.playerId)!;
  const actingId = start.game?.actingPlayerId;
  assert.ok(actingId);
  const actor = [host.identity, guest.identity].find(
    (p) => p.playerId === actingId,
  )!;
  rooms.applyAction(host.room.code, actor.playerId, actor.secret, {
    type: "fold",
  });
  const afterFold = rooms.getPublicState(host.room.code, actor.playerId)!;
  assert.equal(afterFold.game?.street, "showdown");
  const opponent = afterFold.players.find((p) => p.id !== actor.playerId);
  assert.equal(opponent?.holeCards, null);
}

{
  const winners = pickFinalWinners([
    { id: "a", chips: 2000 } as PublicPlayer,
    { id: "b", chips: 0 } as PublicPlayer,
  ]);
  assert.deepEqual(
    winners.map((winner) => winner.id),
    ["a"],
  );
}

{
  const rooms = manager();
  const host = rooms.createRoom({
    name: "房主",
    avatarId: "cat",
  } as never);
  rooms.joinRoom({
    code: host.room.code,
    name: "玩家",
    avatarId: "dog",
  } as never);
  rooms.startGame(
    host.room.code,
    host.identity.playerId,
    host.identity.secret,
  );

  type InternalRoom = {
    players: Map<string, { chips: number }>;
    status: string;
  };
  const internal = rooms as unknown as {
    rooms: Map<string, InternalRoom>;
    beginHand: (room: InternalRoom) => void;
  };
  const room = internal.rooms.get(host.room.code)!;
  const seated = [...room.players.values()];
  seated[0].chips = 2000;
  seated[1].chips = 0;
  internal.beginHand(room);

  const finished = rooms.getPublicState(
    host.room.code,
    host.identity.playerId,
  )!;
  assert.equal(finished.status, "finished");
  assert.equal(pickFinalWinners(finished.players)[0]?.chips, 2000);

  rooms.startGame(
    host.room.code,
    host.identity.playerId,
    host.identity.secret,
  );
  const rematch = rooms.getPublicState(
    host.room.code,
    host.identity.playerId,
  )!;
  assert.equal(rematch.status, "playing");
  assert.equal(
    rematch.players.reduce((sum, player) => sum + player.chips, 0) +
      (rematch.game?.pot ?? 0),
    2000,
  );
}

{
  const rooms = manager();
  assert.equal(rooms.canResume("000000", "x", "y"), false);
  const created = rooms.createRoom({ name: "房主" });
  assert.equal(
    rooms.canResume(
      created.room.code,
      created.identity.playerId,
      created.identity.secret,
    ),
    true,
  );
  rooms.leaveRoom(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
  );
  assert.equal(
    rooms.canResume(
      created.room.code,
      created.identity.playerId,
      created.identity.secret,
    ),
    false,
  );
}

{
  const rooms = manager();
  const created = rooms.createRoom({ name: "房主" });
  assert.equal(created.identity.avatarId, null);
  assert.equal(
    created.room.players.find((p) => p.id === created.identity.playerId)
      ?.avatarId,
    null,
  );

  const guest = rooms.joinRoom({
    code: created.room.code,
    name: "客人",
  });
  assert.equal(guest.identity.avatarId, null);

  const picked = rooms.setAvatar(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
    "tiger",
  );
  assert.equal(picked.avatarId, "tiger");

  rooms.startGame(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
  );
  const afterStart = rooms.getPublicState(
    created.room.code,
    created.identity.playerId,
  )!;
  const host = afterStart.players.find(
    (p) => p.id === created.identity.playerId,
  )!;
  const other = afterStart.players.find((p) => p.id === guest.identity.playerId)!;
  assert.equal(host.avatarId, "tiger");
  assert.ok(other.avatarId, "未选动物应在开局时随机分配");
}

console.log("room manager tests passed");
process.exit(0);

function playToShowdown(
  rooms: RoomManager,
  code: string,
  players: PlayerIdentity[],
) {
  for (let i = 0; i < 80; i += 1) {
    const state = rooms.getPublicState(code, players[0].playerId);
    if (!state?.game || state.game.street === "showdown" || state.game.actingPlayerId == null) {
      return;
    }
    const actingId = state.game.actingPlayerId;
    const actor = players.find((p) => p.playerId === actingId);
    if (!actor) return;
    const you = rooms.getPublicState(code, actor.playerId)?.you;
    const action: GameActionPayload =
      (you?.callAmount ?? 0) > 0 ? { type: "call" } : { type: "check" };
    rooms.applyAction(code, actor.playerId, actor.secret, action);
  }
}
