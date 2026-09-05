import {
  AI_ASSISTANT_SRC,
  ANIMAL_AVATAR_SRCS,
  ANIMAL_STANDEE_SRCS,
  SKILL_ITEM_SRC,
  markImageLoaded,
  preloadImage,
} from "./animal-display";
import {
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
  POKER_TABLE_REFERENCE_SRC,
} from "./critical-images";

/** First-paint boot splash: visible before React / CSS bundle arrive. */

export const BOOT_SPLASH_ID = "boot-splash";
export const BOOT_PROGRESS_FILL_ID = "boot-splash-progress-fill";
export const BOOT_PERCENT_ID = "boot-splash-percent";
export const BOOT_STATUS_ID = "boot-splash-status";

/**
 * All gameplay-critical images. Boot splash stays up until every entry is
 * loaded — no soft timeout — so pages never paint with blank art.
 */
export const BOOT_ASSET_SRCS: readonly string[] = [
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
  AI_ASSISTANT_SRC,
  POKER_TABLE_REFERENCE_SRC,
  SKILL_ITEM_SRC,
  ...ANIMAL_AVATAR_SRCS,
  ...ANIMAL_STANDEE_SRCS,
];

declare global {
  interface Window {
    __BOOT_ASSETS_READY__?: boolean;
    __BOOT_ASSETS_PROGRESS__?: number;
  }
}

/** Inline critical CSS — no dependency on globals.css or Tailwind. */
export const BOOT_SPLASH_STYLE = `
html,body{background:#120e0a;margin:0;}
#${BOOT_SPLASH_ID}{
  position:fixed;inset:0;z-index:2147483000;
  display:flex;align-items:center;justify-content:center;
  background:#120e0a;color:rgba(240,200,120,.92);
  font-family:"PingFang SC","Noto Sans SC",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  transition:opacity .22s ease,visibility .22s ease;
}
#${BOOT_SPLASH_ID}[data-dismissed="true"]{
  opacity:0;visibility:hidden;pointer-events:none;
}
#${BOOT_SPLASH_ID} .boot-splash-inner{
  display:flex;flex-direction:column;align-items:center;gap:1.05rem;
  width:min(18.5rem,78vw);text-align:center;
}
#${BOOT_SPLASH_ID} .boot-splash-spinner{
  position:relative;width:7.5rem;height:7.5rem;
}
#${BOOT_SPLASH_ID} .boot-splash-ring{
  position:absolute;inset:0;border-radius:999px;
  border:3px solid rgba(240,200,120,.18);
  border-top-color:#ffd45c;border-right-color:#e89a2e;
  animation:boot-splash-spin .85s linear infinite;
}
#${BOOT_SPLASH_ID} .boot-splash-logo{
  position:absolute;inset:1.15rem;display:block;margin:0;
  animation:boot-splash-pulse 1.2s ease-in-out infinite;
}
#${BOOT_SPLASH_ID} .boot-splash-logo img{
  display:block;width:100%;height:100%;object-fit:contain;
  filter:drop-shadow(0 4px 10px rgba(0,0,0,.28));
}
#${BOOT_SPLASH_ID} .boot-splash-title{
  margin:0;font-size:.95rem;font-weight:900;letter-spacing:.18em;
  color:#ffe08a;text-transform:uppercase;
}
#${BOOT_SPLASH_ID} .boot-splash-status{
  margin:0;font-size:.72rem;font-weight:700;letter-spacing:.06em;
  color:rgba(240,200,120,.72);
}
#${BOOT_SPLASH_ID} .boot-splash-track{
  width:100%;height:.42rem;border-radius:999px;
  background:rgba(240,200,120,.14);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35);
  overflow:hidden;
}
#${BOOT_SPLASH_ID} .boot-splash-fill{
  display:block;height:100%;width:0%;
  border-radius:inherit;
  background:linear-gradient(90deg,#f0b83a 0%,#ffd45c 55%,#ffe9a0 100%);
  box-shadow:0 0 10px rgba(255,212,92,.35);
  transition:width .16s ease-out;
}
#${BOOT_SPLASH_ID} .boot-splash-percent{
  margin:0;min-width:3.2em;font-size:.9rem;font-weight:900;
  letter-spacing:.06em;font-variant-numeric:tabular-nums;
  color:#ffe08a;
}
@keyframes boot-splash-spin{to{transform:rotate(360deg)}}
@keyframes boot-splash-pulse{
  0%,100%{transform:scale(1);opacity:1}
  50%{transform:scale(1.04);opacity:.88}
}
@media (prefers-reduced-motion:reduce){
  #${BOOT_SPLASH_ID} .boot-splash-ring,
  #${BOOT_SPLASH_ID} .boot-splash-logo{animation:none}
  #${BOOT_SPLASH_ID} .boot-splash-fill{transition:none}
}
`.replace(/\n/g, "");

/**
 * Inline boot script: starts asset fetch before React hydrates and paints
 * progress onto the splash DOM. Waits for every asset's load/error — no
 * timeout — so the app never opens with missing art.
 */
export function buildBootLoaderScript(srcs: readonly string[]): string {
  return `(function(){
var srcs=${JSON.stringify(srcs)};
var total=srcs.length||1;
var done=0;
var finished=false;
function paint(){
  var p=Math.min(100,Math.round(done/total*100));
  window.__BOOT_ASSETS_PROGRESS__=p;
  var root=document.getElementById(${JSON.stringify(BOOT_SPLASH_ID)});
  var fill=document.getElementById(${JSON.stringify(BOOT_PROGRESS_FILL_ID)});
  var pct=document.getElementById(${JSON.stringify(BOOT_PERCENT_ID)});
  var status=document.getElementById(${JSON.stringify(BOOT_STATUS_ID)});
  if(root)root.setAttribute("aria-valuenow",String(p));
  if(fill)fill.style.width=p+"%";
  if(pct)pct.textContent=p+"%";
  if(status)status.textContent=finished?"即将进入":"正在加载资源 "+done+"/"+total;
}
function finish(){
  if(finished)return;
  finished=true;
  window.__BOOT_ASSETS_READY__=true;
  window.__BOOT_ASSETS_PROGRESS__=100;
  paint();
  try{window.dispatchEvent(new Event("boot-assets-ready"));}catch(e){}
}
function one(){
  done+=1;
  paint();
  if(done>=total)finish();
}
paint();
for(var i=0;i<srcs.length;i++){
  (function(src){
    var settled=false;
    function settle(){
      if(settled)return;
      settled=true;
      one();
    }
    var img=new Image();
    img.onload=settle;
    img.onerror=settle;
    img.decoding="async";
    img.src=src;
  })(srcs[i]);
}
if(!srcs.length)finish();
})();`;
}

export function dismissBootSplash() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(BOOT_SPLASH_ID);
  if (!el || el.getAttribute("data-dismissed") === "true") return;
  el.setAttribute("data-dismissed", "true");
  window.setTimeout(() => {
    el.remove();
  }, 240);
}

export function updateBootSplashProgress(loaded: number, total: number) {
  if (typeof document === "undefined") return;
  const safeTotal = Math.max(total, 1);
  const percent = Math.min(100, Math.round((loaded / safeTotal) * 100));
  window.__BOOT_ASSETS_PROGRESS__ = percent;
  const root = document.getElementById(BOOT_SPLASH_ID);
  const fill = document.getElementById(BOOT_PROGRESS_FILL_ID);
  const pct = document.getElementById(BOOT_PERCENT_ID);
  const status = document.getElementById(BOOT_STATUS_ID);
  if (root) root.setAttribute("aria-valuenow", String(percent));
  if (fill) fill.style.width = `${percent}%`;
  if (pct) pct.textContent = `${percent}%`;
  if (status) {
    status.textContent =
      percent >= 100 ? "即将进入" : `正在加载资源 ${loaded}/${safeTotal}`;
  }
}

/** Mark boot assets as ready in the React preload registry (browser cache hit). */
export async function syncBootAssetRegistry(
  srcs: readonly string[] = BOOT_ASSET_SRCS,
): Promise<void> {
  await Promise.all(srcs.map((src) => preloadImage(src)));
  for (const src of srcs) markImageLoaded(src);
}

/** Resolves when the inline boot loader (or React fallback) finishes assets. */
export function waitForBootAssets(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.__BOOT_ASSETS_READY__) return Promise.resolve();

  return new Promise((resolve) => {
    const onReady = () => {
      window.removeEventListener("boot-assets-ready", onReady);
      window.clearInterval(poll);
      resolve();
    };
    window.addEventListener("boot-assets-ready", onReady);
    const poll = window.setInterval(() => {
      if (window.__BOOT_ASSETS_READY__) onReady();
    }, 80);
  });
}

/**
 * React-side fallback preload with the same progress UI, in case the inline
 * script was blocked or the list changed after deploy. No timeout — waits
 * for every asset to load or error.
 */
export async function preloadBootAssetsWithProgress(
  srcs: readonly string[] = BOOT_ASSET_SRCS,
): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__BOOT_ASSETS_READY__) {
    updateBootSplashProgress(srcs.length, srcs.length);
    await syncBootAssetRegistry(srcs);
    return;
  }

  let loaded = 0;
  const total = srcs.length;
  updateBootSplashProgress(0, total);

  await Promise.all(
    srcs.map(async (src) => {
      await preloadImage(src);
      loaded += 1;
      updateBootSplashProgress(loaded, total);
    }),
  );

  window.__BOOT_ASSETS_READY__ = true;
  window.__BOOT_ASSETS_PROGRESS__ = 100;
  updateBootSplashProgress(total, total);
  window.dispatchEvent(new Event("boot-assets-ready"));
}
