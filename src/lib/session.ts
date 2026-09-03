"use client";

import type { AnimalId, PlayerIdentity, RuleMode } from "./types";
import { ANIMALS } from "./types";

const KEY = "critter-holdem.player.sessions";
const LEGACY_KEY = "texas-animal-party.player.sessions";
const NAME_KEY = "critter-holdem.player.name";
const LEGACY_NAME_KEY = "texas-animal-party.player.name";
const VALID_AVATARS = new Set<string>(ANIMALS.map((a) => a.id));

function normalizeAvatarId(id: unknown): AnimalId | null {
  if (typeof id === "string" && VALID_AVATARS.has(id)) return id as AnimalId;
  return null;
}

type SessionEntry = PlayerIdentity & {
  code: string;
  updatedAt: number;
  ruleMode?: RuleMode;
};

type SessionMap = Record<string, SessionEntry>;

function migrateLegacySessions() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEY)) return;
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  localStorage.setItem(KEY, legacy);
  localStorage.removeItem(LEGACY_KEY);
}

function readAll(): SessionMap {
  if (typeof window === "undefined") return {};
  try {
    migrateLegacySessions();
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: SessionMap) {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function saveRoomSession(
  code: string,
  identity: PlayerIdentity,
  ruleMode?: RuleMode,
) {
  const map = readAll();
  const existing = map[code.toUpperCase()];
  map[code.toUpperCase()] = {
    ...identity,
    code: code.toUpperCase(),
    updatedAt: Date.now(),
    ruleMode: ruleMode ?? existing?.ruleMode,
  };
  writeAll(map);
}

const RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RoomResumeOffer = {
  code: string;
  name: string;
};

export type ResumeCandidate = RoomResumeOffer & {
  playerId: string;
  secret: string;
};

export function listResumeCandidates(
  preferredCode?: string | null,
): ResumeCandidate[] {
  const map = readAll();
  const now = Date.now();
  const fresh = (entry: SessionEntry) => now - entry.updatedAt < RESUME_MAX_AGE_MS;
  const toCandidate = (entry: SessionEntry): ResumeCandidate => ({
    code: entry.code,
    name: entry.name,
    playerId: entry.playerId,
    secret: entry.secret,
  });

  if (preferredCode) {
    const entry = map[preferredCode.toUpperCase()];
    return entry && fresh(entry) ? [toCandidate(entry)] : [];
  }

  return Object.values(map)
    .filter(fresh)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toCandidate);
}

export function getRoomSession(code: string): PlayerIdentity | null {
  const entry = readAll()[code.toUpperCase()];
  if (!entry) return null;
  return {
    playerId: entry.playerId,
    secret: entry.secret,
    name: entry.name,
    avatarId: normalizeAvatarId(entry.avatarId),
    spectator: entry.spectator,
  };
}

export function getRoomRuleMode(code: string): RuleMode | null {
  const entry = readAll()[code.toUpperCase()];
  if (!entry?.ruleMode) return null;
  return entry.ruleMode === "skill" ? "skill" : "classic";
}

export function clearRoomSession(code: string) {
  const map = readAll();
  delete map[code.toUpperCase()];
  writeAll(map);
}

export function getPreferredName(): string {
  if (typeof window === "undefined") return "";
  const current = localStorage.getItem(NAME_KEY);
  if (current) return current;
  const legacy = localStorage.getItem(LEGACY_NAME_KEY);
  if (!legacy) return "";
  localStorage.setItem(NAME_KEY, legacy);
  localStorage.removeItem(LEGACY_NAME_KEY);
  return legacy;
}

export function setPreferredName(name: string) {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 16));
  localStorage.removeItem(LEGACY_NAME_KEY);
}
