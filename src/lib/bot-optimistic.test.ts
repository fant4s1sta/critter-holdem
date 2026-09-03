import assert from "node:assert/strict";
import { pickNextAvailableAvatar } from "./bot-optimistic";
import type { AnimalId } from "./types";

{
  assert.equal(pickNextAvailableAvatar(new Set<AnimalId>()), "dog");
}

{
  assert.equal(pickNextAvailableAvatar(new Set<AnimalId>(["dog"])), "cat");
}

{
  assert.equal(
    pickNextAvailableAvatar(new Set<AnimalId>(["dog", "cat"])),
    "mouse",
  );
}

console.log("bot-optimistic.test.ts ok");
