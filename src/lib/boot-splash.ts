/** First-paint boot splash: visible before React / CSS bundle arrive. */

export const BOOT_SPLASH_ID = "boot-splash";

/** Inline critical CSS — no dependency on globals.css or Tailwind. */
export const BOOT_SPLASH_STYLE = `
html,body{background:#120e0a;margin:0;}
#${BOOT_SPLASH_ID}{
  position:fixed;inset:0;z-index:2147483000;
  display:flex;align-items:center;justify-content:center;
  background:#120e0a;color:rgba(240,200,120,.88);
  font-family:"PingFang SC","Noto Sans SC",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  transition:opacity .18s ease,visibility .18s ease;
}
#${BOOT_SPLASH_ID}[data-dismissed="true"]{
  opacity:0;visibility:hidden;pointer-events:none;
}
#${BOOT_SPLASH_ID} .boot-splash-inner{
  display:flex;flex-direction:column;align-items:center;gap:1.15rem;
  text-align:center;
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
#${BOOT_SPLASH_ID} .boot-splash-label{
  margin:0;font-size:.82rem;font-weight:800;
  letter-spacing:.12em;text-transform:uppercase;
  animation:boot-splash-label 1.2s ease-in-out infinite;
}
@keyframes boot-splash-spin{to{transform:rotate(360deg)}}
@keyframes boot-splash-pulse{
  0%,100%{transform:scale(1);opacity:1}
  50%{transform:scale(1.04);opacity:.88}
}
@keyframes boot-splash-label{
  0%,100%{opacity:.72}
  50%{opacity:1}
}
@media (prefers-reduced-motion:reduce){
  #${BOOT_SPLASH_ID} .boot-splash-ring,
  #${BOOT_SPLASH_ID} .boot-splash-logo,
  #${BOOT_SPLASH_ID} .boot-splash-label{animation:none}
}
`.replace(/\n/g, "");

export function dismissBootSplash() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(BOOT_SPLASH_ID);
  if (!el || el.getAttribute("data-dismissed") === "true") return;
  el.setAttribute("data-dismissed", "true");
  window.setTimeout(() => {
    el.remove();
  }, 220);
}
