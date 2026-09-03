import { ANIMALS, type AnimalId } from "./types";

/** Prefer unused animals; fall back to any if all taken. First free entry. */
export function pickNextAvailableAvatar(used: ReadonlySet<AnimalId>): AnimalId {
  const free = ANIMALS.filter((animal) => !used.has(animal.id));
  const pool = free.length > 0 ? free : ANIMALS;
  return pool[0]!.id;
}
