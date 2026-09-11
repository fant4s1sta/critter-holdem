import {
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
import { EMOTE_STICKER_SRC } from "./emotes";
import { TABLE_ITEM_SRCS } from "./table-items";

/** First-paint boot splash: visible before React / CSS bundle arrive. */

export const BOOT_SPLASH_ID = "boot-splash";
export const BOOT_PROGRESS_FILL_ID = "boot-splash-progress-fill";
export const BOOT_PERCENT_ID = "boot-splash-percent";
export const BOOT_STATUS_ID = "boot-splash-status";

/**
 * Home lobby first paint — keep the splash short. Logo + casino backdrop only.
 */
export const LOBBY_BOOT_ASSET_SRCS: readonly string[] = [
  BRAND_LOGO_WEBP_SRC,
  CASINO_BACKGROUND_SRC,
];

/**
 * Room / table art. Loaded after lobby (or gated by RoomGate) so gameplay
 * never paints blank seats, stickers, or table felt.
 */
export const TABLE_BOOT_ASSET_SRCS: readonly string[] = [
  POKER_TABLE_REFERENCE_SRC,
  SKILL_ITEM_SRC,
  EMOTE_STICKER_SRC,
  ...TABLE_ITEM_SRCS,
  ...ANIMAL_AVATAR_SRCS,
  ...ANIMAL_STANDEE_SRCS,
];

/** Full boot set (lobby + table). Prefer the phased lists for gating. */
export const BOOT_ASSET_SRCS: readonly string[] = [
  ...LOBBY_BOOT_ASSET_SRCS,
  ...TABLE_BOOT_ASSET_SRCS,
];

declare global {
  interface Window {
    /** Lobby-critical images settled (home may open). */
    __BOOT_LOBBY_READY__?: boolean;
    /** Table / room images settled (room may open). */
    __BOOT_TABLE_READY__?: boolean;
    /** All boot images settled (lobby + table). */
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

function uniqueSrcs(srcs: readonly string[]): string[] {
  return [...new Set(srcs)];
}

/**
 * Inline boot script: load lobby assets first (splash progress), signal home
 * ready, then warm table assets in the background. Retries failed URLs a few
 * times; no wall-clock timeout.
 */
export function buildBootLoaderScript(
  lobbySrcs: readonly string[] = LOBBY_BOOT_ASSET_SRCS,
  tableSrcs: readonly string[] = TABLE_BOOT_ASSET_SRCS,
): string {
  const lobby = uniqueSrcs(lobbySrcs);
  const table = uniqueSrcs(tableSrcs).filter((src) => !lobby.includes(src));
  return `(function(){
var lobby=${JSON.stringify(lobby)};
var table=${JSON.stringify(table)};
var lobbyTotal=lobby.length||1;
var lobbyDone=0;
var tableDone=0;
var lobbyFinished=false;
var tableFinished=false;
var maxAttempts=3;
function paintLobby(){
  var p=Math.min(100,Math.round(lobbyDone/lobbyTotal*100));
  window.__BOOT_ASSETS_PROGRESS__=p;
  var root=document.getElementById(${JSON.stringify(BOOT_SPLASH_ID)});
  var fill=document.getElementById(${JSON.stringify(BOOT_PROGRESS_FILL_ID)});
  var pct=document.getElementById(${JSON.stringify(BOOT_PERCENT_ID)});
  var status=document.getElementById(${JSON.stringify(BOOT_STATUS_ID)});
  if(root)root.setAttribute("aria-valuenow",String(p));
  if(fill)fill.style.width=p+"%";
  if(pct)pct.textContent=p+"%";
  if(status)status.textContent=lobbyFinished?"即将进入":"正在加载资源 "+lobbyDone+"/"+lobbyTotal;
}
function finishLobby(){
  if(lobbyFinished)return;
  lobbyFinished=true;
  window.__BOOT_LOBBY_READY__=true;
  window.__BOOT_ASSETS_PROGRESS__=100;
  paintLobby();
  try{window.dispatchEvent(new Event("boot-lobby-ready"));}catch(e){}
  loadGroup(table,onTableOne,finishTable);
}
function finishTable(){
  if(tableFinished)return;
  tableFinished=true;
  window.__BOOT_TABLE_READY__=true;
  window.__BOOT_ASSETS_READY__=true;
  try{window.dispatchEvent(new Event("boot-table-ready"));}catch(e){}
  try{window.dispatchEvent(new Event("boot-assets-ready"));}catch(e){}
}
function onLobbyOne(){
  lobbyDone+=1;
  paintLobby();
  if(lobbyDone>=lobbyTotal)finishLobby();
}
function onTableOne(){
  tableDone+=1;
  if(tableDone>=(table.length||0) && table.length===0)finishTable();
  if(table.length>0 && tableDone>=table.length)finishTable();
}
function loadGroup(srcs,onOne,onEmpty){
  if(!srcs.length){onEmpty();return;}
  for(var i=0;i<srcs.length;i++){
    (function(src){
      var settled=false;
      var attempts=0;
      function settle(){
        if(settled)return;
        settled=true;
        onOne();
      }
      function load(){
        attempts+=1;
        var img=new Image();
        img.onload=settle;
        img.onerror=function(){
          if(attempts<maxAttempts){
            setTimeout(load, 120*attempts);
            return;
          }
          settle();
        };
        img.decoding="async";
        img.src=src+(attempts>1?((src.indexOf("?")>=0?"&":"?")+"retry="+attempts):"");
      }
      load();
    })(srcs[i]);
  }
}
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",paintLobby);
else paintLobby();
loadGroup(lobby,onLobbyOne,finishLobby);
})();`;
}

export function dismissBootSplash() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(BOOT_SPLASH_ID);
  if (!el || el.getAttribute("data-dismissed") === "true") return;
  // Wait two frames so the first real screen can paint under the splash
  // before it fades — avoids a one-frame blank between splash and UI.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (!el.isConnected || el.getAttribute("data-dismissed") === "true") return;
      el.setAttribute("data-dismissed", "true");
      window.setTimeout(() => {
        el.remove();
      }, 240);
    });
  });
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

/** Mark assets as ready in the React preload registry (browser cache hit). */
export async function syncBootAssetRegistry(
  srcs: readonly string[] = BOOT_ASSET_SRCS,
): Promise<void> {
  await Promise.all(srcs.map((src) => preloadImage(src)));
  for (const src of srcs) markImageLoaded(src);
}

function waitForWindowFlag(
  flag: "__BOOT_LOBBY_READY__" | "__BOOT_TABLE_READY__" | "__BOOT_ASSETS_READY__",
  eventName: string,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window[flag]) return Promise.resolve();

  return new Promise((resolve) => {
    const onReady = () => {
      window.removeEventListener(eventName, onReady);
      window.clearInterval(poll);
      resolve();
    };
    window.addEventListener(eventName, onReady);
    const poll = window.setInterval(() => {
      if (window[flag]) onReady();
    }, 80);
  });
}

/** Resolves when lobby-critical images are ready (home may open). */
export function waitForLobbyBootAssets(): Promise<void> {
  return waitForWindowFlag("__BOOT_LOBBY_READY__", "boot-lobby-ready");
}

/** Resolves when table / room images are ready. */
export function waitForTableBootAssets(): Promise<void> {
  return waitForWindowFlag("__BOOT_TABLE_READY__", "boot-table-ready");
}

/** Resolves when the full boot set is ready (lobby + table). */
export function waitForBootAssets(): Promise<void> {
  return waitForWindowFlag("__BOOT_ASSETS_READY__", "boot-assets-ready");
}

async function preloadSrcGroup(
  srcs: readonly string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const list = uniqueSrcs(srcs);
  let loaded = 0;
  const total = list.length;
  onProgress?.(0, total);
  await Promise.all(
    list.map(async (src) => {
      await preloadImage(src);
      markImageLoaded(src);
      loaded += 1;
      onProgress?.(loaded, total);
    }),
  );
}

/**
 * React-side fallback: load lobby first (splash progress), then warm table
 * assets. Used when the inline script is blocked or the list changed.
 */
export async function preloadBootAssetsWithProgress(
  lobbySrcs: readonly string[] = LOBBY_BOOT_ASSET_SRCS,
  tableSrcs: readonly string[] = TABLE_BOOT_ASSET_SRCS,
): Promise<void> {
  if (typeof window === "undefined") return;

  if (window.__BOOT_LOBBY_READY__ && window.__BOOT_TABLE_READY__) {
    window.__BOOT_ASSETS_READY__ = true;
    updateBootSplashProgress(1, 1);
    await syncBootAssetRegistry([...lobbySrcs, ...tableSrcs]);
    return;
  }

  if (!window.__BOOT_LOBBY_READY__) {
    await preloadSrcGroup(lobbySrcs, updateBootSplashProgress);
    window.__BOOT_LOBBY_READY__ = true;
    window.__BOOT_ASSETS_PROGRESS__ = 100;
    updateBootSplashProgress(lobbySrcs.length || 1, lobbySrcs.length || 1);
    window.dispatchEvent(new Event("boot-lobby-ready"));
  }

  if (!window.__BOOT_TABLE_READY__) {
    await preloadSrcGroup(tableSrcs);
    window.__BOOT_TABLE_READY__ = true;
    window.__BOOT_ASSETS_READY__ = true;
    window.dispatchEvent(new Event("boot-table-ready"));
    window.dispatchEvent(new Event("boot-assets-ready"));
  }
}

/** Ensure table assets are cached before mounting room UI. */
export async function ensureTableBootAssets(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.__BOOT_TABLE_READY__) {
    await syncBootAssetRegistry(TABLE_BOOT_ASSET_SRCS);
    return;
  }

  await preloadSrcGroup(TABLE_BOOT_ASSET_SRCS);
  window.__BOOT_TABLE_READY__ = true;
  window.__BOOT_ASSETS_READY__ = true;
  window.dispatchEvent(new Event("boot-table-ready"));
  window.dispatchEvent(new Event("boot-assets-ready"));
}

/** Warm table assets after lobby is up (non-blocking for home). */
export function warmTableBootAssets(): void {
  if (typeof window === "undefined") return;
  if (window.__BOOT_TABLE_READY__) return;
  void ensureTableBootAssets();
}
