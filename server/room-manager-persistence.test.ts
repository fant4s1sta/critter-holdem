import assert from "node:assert/strict";
import { RoomManager } from "./room-manager";
import { MemoryRoomRepository } from "./persistence/room-repository";
import type { RoomSnapshot } from "./persistence/room-snapshot";

async function main() {
  const repository = new MemoryRoomRepository<RoomSnapshot>();
  const first = new RoomManager({
    emitRoom: () => undefined,
    repository,
  });
  const created = first.createRoom({ name: "房主", aiCount: 2 });
  await first.flushPersistence();
  first.setAvatar(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
    "cat",
  );
  first.setAvatar(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
    "dog",
  );
  await first.flushPersistence();

  const second = new RoomManager({
    emitRoom: () => undefined,
    repository,
  });
  assert.equal(await second.hydrate(created.room.code), true);
  assert.equal(
    second.getPublicState(created.room.code, created.identity.playerId)?.players
      .length,
    3,
  );
  assert.equal((await repository.get(created.room.code))?.rev, 2);
  const restored = second.reconnect({
    code: created.room.code,
    playerId: created.identity.playerId,
    secret: created.identity.secret,
    socketId: "restored-socket",
  });
  assert.equal(restored.code, created.room.code);
  await second.flushPersistence();

  const emptyRoom = first.createRoom({ name: "待删除房间" });
  await first.flushPersistence();
  first.leaveRoom(
    emptyRoom.room.code,
    emptyRoom.identity.playerId,
    emptyRoom.identity.secret,
  );
  await first.flushPersistence();
  assert.equal(await repository.get(emptyRoom.room.code), null);

  await testWriteBehindBroadcast();
  await testConflictResync();

  console.log("room manager persistence tests passed");
}

/** Clients must be updated before the store round-trip, not after it. */
async function testWriteBehindBroadcast() {
  const inner = new MemoryRoomRepository<RoomSnapshot>();
  const gate: { release: (() => void) | null } = { release: null };
  const slow = {
    get: (code: string) => inner.get(code),
    delete: (code: string) => inner.delete(code),
    close: () => inner.close(),
    set: async (code: string, snapshot: RoomSnapshot, expectedRev: number | null) => {
      await new Promise<void>((resolve) => {
        gate.release = resolve;
      });
      await inner.set(code, snapshot, expectedRev);
    },
  };
  const emits: Array<{ code: string; forceFull: boolean }> = [];
  const persisted: string[] = [];
  const manager = new RoomManager({
    emitRoom: (code, options) =>
      emits.push({ code, forceFull: options?.forceFull ?? false }),
    onPersisted: (code) => persisted.push(code),
    repository: slow,
  });

  const created = manager.createRoom({ name: "房主" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  gate.release!();
  await manager.flushPersistence();
  assert.equal((await inner.get(created.room.code))?.rev, 0);

  manager.setAvatar(
    created.room.code,
    created.identity.playerId,
    created.identity.secret,
    "cat",
  );
  assert.equal(emits.length, 1, "broadcast happens synchronously");
  assert.equal(persisted.length, 0, "store has not been written yet");
  assert.equal(
    manager.getPublicState(created.room.code, created.identity.playerId)?.rev,
    1,
    "revision advances before the write lands",
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  const release = gate.release as (() => void) | null;
  assert.ok(release, "write was queued");
  release();
  await manager.flushPersistence();
  assert.deepEqual(persisted, [created.room.code]);
  assert.equal((await inner.get(created.room.code))?.rev, 1);
}

/**
 * When another instance has already advanced the room, our write is rejected;
 * the manager must reload the store's version and force a full resync rather
 * than reject the action or leave clients on a phantom revision.
 */
async function testConflictResync() {
  const repository = new MemoryRoomRepository<RoomSnapshot>();
  const emitsB: Array<{ forceFull: boolean }> = [];
  const a = new RoomManager({ emitRoom: () => undefined, repository });
  const b = new RoomManager({
    emitRoom: (_code, options) =>
      emitsB.push({ forceFull: options?.forceFull ?? false }),
    repository,
  });

  const created = a.createRoom({ name: "房主" });
  await a.flushPersistence();
  assert.equal(await b.hydrate(created.room.code), true);
  b.reconnect({
    code: created.room.code,
    playerId: created.identity.playerId,
    secret: created.identity.secret,
    socketId: "b-socket",
  });
  await b.flushPersistence();
  await a.hydrate(created.room.code, true);

  // A moves the room to rev 2; B still believes it is at rev 1.
  a.setAvatar(created.room.code, created.identity.playerId, created.identity.secret, "cat");
  await a.flushPersistence();
  assert.equal((await repository.get(created.room.code))?.rev, 2);

  emitsB.length = 0;
  b.setAvatar(created.room.code, created.identity.playerId, created.identity.secret, "dog");
  assert.deepEqual(emitsB, [{ forceFull: false }], "optimistic broadcast first");
  await b.flushPersistence(); // must resolve, not reject

  assert.deepEqual(
    emitsB,
    [{ forceFull: false }, { forceFull: true }],
    "conflict triggers a forced full resync",
  );
  const stored = await repository.get(created.room.code);
  assert.equal(stored?.rev, 2, "stale write never reached the store");
  const viewB = b.getPublicState(created.room.code, created.identity.playerId)!;
  assert.equal(viewB.rev, 2);
  assert.equal(
    viewB.players.find((p) => p.id === created.identity.playerId)?.avatarId,
    "cat",
    "B adopts the store's version",
  );
}

void main();
