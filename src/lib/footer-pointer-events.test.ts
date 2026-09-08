import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression: game/lobby footers are pulled up over bottom seats (3–6).
 * Empty chrome must use pointer-events: none so seat avatars stay tappable;
 * only real controls re-enable hits (otherwise taps can miss-hit 弃牌).
 */
const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

function declarationsFor(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match either a solo rule or a selector inside a comma-separated group.
  const match = css.match(
    new RegExp(
      `(?:^|[,\\s}])\\s*${escaped}\\s*(?:,[^/{]*)?\\{([^}]*)\\}`,
      "m",
    ),
  );
  assert.ok(match, `missing CSS rule covering ${selector}`);
  return match[1];
}

assert.match(declarationsFor(".game-footer"), /pointer-events:\s*none/);
assert.match(declarationsFor(".lobby-table-footer"), /pointer-events:\s*none/);

for (const selector of [
  ".game-footer .win-rate-hint",
  ".game-footer .skill-cast-btn",
  ".game-footer .game-action-panel button",
  ".game-footer .game-action-panel input",
  ".game-footer .game-action-panel label",
  ".lobby-table-footer .lobby-avatar-picker",
  ".lobby-table-footer .lobby-btn",
  ".lobby-table-footer .lobby-cta",
]) {
  assert.match(declarationsFor(selector), /pointer-events:\s*auto/);
}

// Footer must not re-enable the whole action panel — only controls —
// or the panel chrome still blocks seats 3–6.
assert.doesNotMatch(
  css,
  /\.game-footer\s+\.game-action-panel\s*\{[^}]*pointer-events:\s*auto/,
);

// When flights / hit fx lift .table-play above the footer, hole cards and
// status text must stay painted on top of the felt.
assert.match(
  declarationsFor(".lobby-table-shell:has(.item-flight) .game-footer"),
  /z-index:\s*10/,
);

// Portaled seat menus live in .table-social-overlay above the footer.
assert.match(declarationsFor(".table-social-overlay"), /z-index:\s*20/);
assert.match(
  declarationsFor(".table-social-overlay"),
  /pointer-events:\s*none/,
);

console.log("footer-pointer-events.test.ts: ok");
