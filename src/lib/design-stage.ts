/**
 * Design canvas: iPhone 17 Pro Max CSS viewport (440 × 956).
 * All layout is authored in these design px; the whole app is then scaled
 * uniformly so every phone renders the same composition at its own width.
 */
export const DESIGN_WIDTH = 440;

/**
 * Viewports narrower than this are treated as phones and scale purely by
 * width (extra vertical room is left to the backdrop). Wider viewports
 * (tablet / desktop) additionally cap the scale so the stage keeps at least
 * MIN_STAGE_HEIGHT design px of height instead of blowing up off-screen.
 */
export const PHONE_MAX_WIDTH = 600;
export const MIN_STAGE_HEIGHT = 820;

export function computeStageScale(
  viewportWidth: number,
  viewportHeight: number,
): number {
  if (!(viewportWidth > 0)) return 1;
  let scale = viewportWidth / DESIGN_WIDTH;
  if (viewportWidth >= PHONE_MAX_WIDTH && viewportHeight > 0) {
    scale = Math.min(scale, viewportHeight / MIN_STAGE_HEIGHT);
  }
  return Math.round(scale * 10000) / 10000;
}

export function applyStageScale(win: Window = window) {
  const scale = computeStageScale(win.innerWidth, win.innerHeight);
  win.document.documentElement.style.setProperty(
    "--stage-scale",
    String(scale),
  );
}
