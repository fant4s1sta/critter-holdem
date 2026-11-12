export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

function parseRoomCode(raw: string): string | null {
  const digits = normalizeRoomCode(raw);
  return digits.length === 6 ? digits : null;
}

export function readRoomCodeFromLocation(): string | null {
  const query = new URLSearchParams(window.location.search).get("room");
  if (query) return parseRoomCode(query);
  const match = window.location.pathname.match(/^\/room\/([^/]+)\/?$/i);
  return match ? parseRoomCode(match[1]) : null;
}

export function replaceRoomUrl(code: string | null) {
  const next = code ? `/?room=${code}` : "/";
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === next) return;
  window.history.replaceState(null, "", next);
}
