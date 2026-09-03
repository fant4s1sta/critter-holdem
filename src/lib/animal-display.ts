import { ANIMALS, type AnimalId } from "./types";

export const UNSET_AVATAR_EMOJI = "❓";

export function animalName(id: AnimalId | null | undefined): string {
  if (!id) return "未选择";
  return ANIMALS.find((animal) => animal.id === id)?.name ?? "未选择";
}

export const ANIMAL_AVATAR_BG: Record<AnimalId, string> = {
  dog: "#F0B429",
  cat: "#F27457",
  mouse: "#8FA3C4",
  hamster: "#E8A23A",
  rabbit: "#F0A8C0",
  fox: "#E86A2A",
  bear: "#C47A3A",
  panda: "#5AAA62",
  "polar-bear": "#6BB8D8",
  koala: "#88B06A",
  tiger: "#F0A010",
  lion: "#E0B820",
  cow: "#7EC8C0",
  pig: "#F090A8",
  frog: "#62C04A",
  dragon: "#2DB8A0",
};

export function animalAvatarSrc(id: AnimalId | null | undefined): string | null {
  if (!id) return null;
  if (!ANIMALS.some((animal) => animal.id === id)) return null;
  return `/avatars/${id}.webp`;
}

export function animalAvatarBg(id: AnimalId | null | undefined): string {
  if (!id) return "#2a241c";
  return ANIMAL_AVATAR_BG[id] ?? "#2a241c";
}

const ANIMAL_AVATAR_SCALE: Partial<Record<AnimalId, number>> = {
  pig: 0.9,
  hamster: 0.8,
  mouse: 0.8,
  cat: 0.9,
  frog: 0.9,
};

export function animalAvatarScale(id: AnimalId | null | undefined): number {
  if (!id) return 1;
  return ANIMAL_AVATAR_SCALE[id] ?? 1;
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
