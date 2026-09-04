import assert from "node:assert/strict";
import { pickNextAvailableAvatar } from "./bot-optimistic";
import type { AnimalId } from "./types";

{
  assert.equal(pickNextAvailableAvatar(new Set<AnimalId>()), "lizard");
}

{
  assert.equal(pickNextAvailableAvatar(new Set<AnimalId>(["lizard"])), "tiger");
}

{
  assert.equal(
    pickNextAvailableAvatar(new Set<AnimalId>(["lizard", "tiger"])),
    "cat",
  );
}

console.log("bot-optimistic.test.ts ok");
