import assert from "node:assert/strict";
import {
  MemoryRoomRepository,
  RoomRevisionConflictError,
} from "./room-repository";

type Snapshot = { rev: number; value: string };

async function main() {
  const repository = new MemoryRoomRepository<Snapshot>();

  await repository.set("abc123", { rev: 1, value: "first" }, null);
  assert.deepEqual(await repository.get("ABC123"), { rev: 1, value: "first" });

  await repository.set("ABC123", { rev: 2, value: "second" }, 1);
  assert.deepEqual(await repository.get("abc123"), { rev: 2, value: "second" });

  await assert.rejects(
    repository.set("abc123", { rev: 3, value: "stale" }, 1),
    RoomRevisionConflictError,
  );

  await repository.delete("ABC123");
  assert.equal(await repository.get("abc123"), null);

  console.log("room repository tests passed");
}

void main();
