import type {
  PublicPlayer,
  PublicPlayerPatch,
  RoomPatch,
  RoomPublicState,
  TexasHoldemPublicState,
} from "./types";
import { recomputeViewerYou } from "./player-action-ui";

const GAME_PATCH_KEYS: (keyof TexasHoldemPublicState)[] = [
  "gameType",
  "handNumber",
  "street",
  "communityCards",
  "pot",
  "currentBet",
  "minRaise",
  "dealerSeat",
  "smallBlindSeat",
  "bigBlindSeat",
  "actingSeat",
  "actingPlayerId",
  "turnEndsAt",
  "nextHandAt",
  "smallBlind",
  "bigBlind",
  "winners",
  "handSummary",
  "lastAction",
];

const PLAYER_PATCH_KEYS: (keyof PublicPlayer)[] = [
  "name",
  "avatarId",
  "seat",
  "chips",
  "connected",
  "away",
  "aiControlled",
  "isHost",
  "folded",
  "allIn",
  "betThisStreet",
  "holeCards",
  "holeCardCount",
];

function stableEqual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function shouldForceFullSync(
  prev: RoomPublicState,
  next: RoomPublicState,
): boolean {
  if (prev.status !== next.status) return true;
  if (prev.players.length !== next.players.length) return true;
  if ((prev.game?.handNumber ?? 0) !== (next.game?.handNumber ?? 0)) return true;

  const prevIds = new Set(prev.players.map((p) => p.id));
  if (next.players.some((p) => !prevIds.has(p.id))) return true;

  return false;
}

function diffPlayer(
  prev: PublicPlayer,
  next: PublicPlayer,
): PublicPlayerPatch | null {
  const patch: PublicPlayerPatch = { id: next.id };
  let changed = false;

  for (const key of PLAYER_PATCH_KEYS) {
    if (!stableEqual(prev[key], next[key])) {
      (patch as Record<string, unknown>)[key] = next[key];
      changed = true;
    }
  }

  return changed ? patch : null;
}

function diffGame(
  prev: RoomPublicState["game"],
  next: RoomPublicState["game"],
): RoomPatch["game"] | undefined {
  if (prev === next) return undefined;
  if (!next) return null;
  if (!prev) return next;

  const patch: Partial<TexasHoldemPublicState> = {};
  let changed = false;

  for (const key of GAME_PATCH_KEYS) {
    if (!stableEqual(prev[key], next[key])) {
      patch[key] = next[key] as never;
      changed = true;
    }
  }

  return changed ? patch : undefined;
}

export function diffRoomState(
  prev: RoomPublicState,
  next: RoomPublicState,
  rev: number,
): RoomPatch | null {
  const patch: RoomPatch = { rev, code: next.code };
  let changed = false;

  if (prev.status !== next.status) {
    patch.status = next.status;
    changed = true;
  }
  if (prev.hostId !== next.hostId) {
    patch.hostId = next.hostId;
    changed = true;
  }
  if (!stableEqual(prev.message, next.message)) {
    patch.message = next.message;
    changed = true;
  }

  const gamePatch = diffGame(prev.game, next.game);
  if (gamePatch !== undefined) {
    patch.game = gamePatch;
    changed = true;
    // Keep viewer action hints in sync whenever table action state changes.
    if (next.you !== undefined) {
      patch.you = next.you;
    }
  }

  if (!stableEqual(prev.you, next.you) && patch.you === undefined) {
    patch.you = next.you;
    changed = true;
  }

  const playerPatches: PublicPlayerPatch[] = [];
  const prevById = new Map(prev.players.map((p) => [p.id, p]));
  for (const np of next.players) {
    const pp = prevById.get(np.id);
    if (!pp) {
      playerPatches.push(np);
      continue;
    }
    const delta = diffPlayer(pp, np);
    if (delta) playerPatches.push(delta);
  }

  if (playerPatches.length > 0) {
    patch.players = playerPatches;
    changed = true;
    const viewerId = prev.you?.playerId;
    if (
      viewerId &&
      patch.you === undefined &&
      playerPatches.some(
        (playerPatch) =>
          playerPatch.id === viewerId &&
          (playerPatch.betThisStreet !== undefined ||
            playerPatch.chips !== undefined ||
            playerPatch.allIn !== undefined ||
            playerPatch.folded !== undefined),
      )
    ) {
      patch.you = next.you;
    }
  }

  return changed ? patch : null;
}

export function mergeRoomPatch(
  room: RoomPublicState,
  patch: RoomPatch,
): RoomPublicState {
  const next: RoomPublicState = {
    ...room,
    rev: patch.rev,
    code: patch.code,
    players: [...room.players],
  };

  if (patch.status !== undefined) next.status = patch.status;
  if (patch.hostId !== undefined) next.hostId = patch.hostId;
  if (patch.message !== undefined) next.message = patch.message;

  if (patch.game !== undefined) {
    if (patch.game === null) {
      next.game = null;
    } else if (next.game) {
      next.game = { ...next.game, ...patch.game };
    } else {
      next.game = patch.game as TexasHoldemPublicState;
    }
  }

  if (patch.you !== undefined) {
    next.you = patch.you;
  }

  if (patch.players?.length) {
    const byId = new Map(next.players.map((p) => [p.id, p]));
    for (const pp of patch.players) {
      const existing = byId.get(pp.id);
      if (existing) {
        byId.set(pp.id, { ...existing, ...pp });
      } else {
        byId.set(pp.id, pp as PublicPlayer);
      }
    }
    next.players = [...byId.values()].sort((a, b) => a.seat - b.seat);
  }

  return recomputeViewerYou(next);
}
