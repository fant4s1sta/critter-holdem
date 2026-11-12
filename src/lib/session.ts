import type { PlayerIdentity } from "./types";

const SESSION_KEY = "critter-holdem.session.v2";
const NAME_KEY = "critter-holdem.player.name";

export type Session = PlayerIdentity & { code: string };

export function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as Session | null;
    if (!value || typeof value.code !== "string" || !/^\d{6}$/.test(value.code) ||
        typeof value.playerId !== "string" || typeof value.secret !== "string" || typeof value.name !== "string") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // The active connection also keeps its identity in memory.
  }
}

export function getPreferredName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePreferredName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Room entry still works with browser storage disabled.
  }
}
