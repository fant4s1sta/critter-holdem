import { ANIMALS, type AnimalId } from "./types";

export const UNSET_AVATAR_EMOJI = "❓";

export function animalName(id: AnimalId | null | undefined): string {
  if (!id) return "未选择";
  return ANIMALS.find((animal) => animal.id === id)?.name ?? "未选择";
}

export const ANIMAL_AVATAR_BG: Record<AnimalId, string> = {
  lizard: "#7BC86A",
  tiger: "#F0A010",
  cat: "#5A4A6A",
  rabbit: "#F0A8C0",
  panda: "#5AAA62",
  alpaca: "#E8D4B0",
  dog: "#F0B429",
  gorilla: "#8A7A68",
  mouse: "#8FA3C4",
  otter: "#C4A070",
  pig: "#F090A8",
  koala: "#88B06A",
  ox: "#D4B06A",
  elephant: "#7EC8C0",
  lion: "#E0B820",
  fox: "#E86A2A",
};

export function animalAvatarSrc(id: AnimalId | null | undefined): string | null {
  if (!id) return null;
  if (!ANIMALS.some((animal) => animal.id === id)) return null;
  return `/avatars/${id}.webp`;
}

export function animalStandeeSrc(id: AnimalId | null | undefined): string | null {
  if (!id) return null;
  if (!ANIMALS.some((animal) => animal.id === id)) return null;
  return `/standees/${id}.webp`;
}

export function animalAvatarBgRgb(id: AnimalId | null | undefined): string {
  const hex = animalAvatarBg(id).replace("#", "");
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function animalAvatarBg(id: AnimalId | null | undefined): string {
  if (!id) return "#2a241c";
  return ANIMAL_AVATAR_BG[id] ?? "#2a241c";
}

const ANIMAL_AVATAR_SCALE: Partial<Record<AnimalId, number>> = {
  gorilla: 1.32,
  elephant: 1.32,
};

export function animalAvatarScale(id: AnimalId | null | undefined): number {
  if (!id) return 1;
  return ANIMAL_AVATAR_SCALE[id] ?? 1;
}

const ANIMAL_STANDEE_SCALE: Partial<Record<AnimalId, number>> = {
  elephant: 1.22,
  lizard: 1.22,
  mouse: 1.16,
};

export function animalStandeeScale(id: AnimalId | null | undefined): number {
  if (!id) return 1;
  return ANIMAL_STANDEE_SCALE[id] ?? 1;
}

export const AI_ASSISTANT_SRC = "/ai-assistant.webp";
export const SKILL_ITEM_SRC = "/skill-item.png";

const preloadCache = new Map<string, Promise<void>>();
const loadedSrcs = new Set<string>();

export function preloadImage(src: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  if (loadedSrcs.has(src)) return Promise.resolve();

  const cached = preloadCache.get(src);
  if (cached) return cached;

  const pending = new Promise<void>((resolve) => {
    const image = new Image();
    const done = () => {
      markImageLoaded(src);
      resolve();
    };
    image.onload = done;
    image.onerror = done;
    image.src = src;
    if (image.complete && image.naturalWidth > 0) done();
  });
  preloadCache.set(src, pending);
  return pending;
}

export function isImagePreloaded(src: string): boolean {
  return loadedSrcs.has(src);
}

export function markImageLoaded(src: string): void {
  loadedSrcs.add(src);
}

export const ANIMAL_AVATAR_SRCS = ANIMALS.map(
  (animal) => `/avatars/${animal.id}.webp`,
);

export function preloadAllAnimalAvatars(): Promise<void> {
  return Promise.all([
    ...ANIMAL_AVATAR_SRCS.map((src) => preloadImage(src)),
    preloadImage(AI_ASSISTANT_SRC),
  ]).then(() => undefined);
}
