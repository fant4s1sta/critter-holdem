# 布局与等比缩放规范（Design Stage）

本项目是手机 H5 游戏，要求在所有机型上元素的尺寸与相对位置看起来完全一致。
实现方式是**固定设计分辨率 + 整页等比缩放**，所有布局都在一个 440px 宽的"设计舞台"
（`.design-stage`）里编写，再由 `transform: scale()` 统一缩放到真实屏幕。

修改任何布局、尺寸、间距、字号前，请先读完本文。

## 1. 基准与缩放规则

| 项目 | 值 | 定义位置 |
|---|---|---|
| 设计基准机型 | iPhone 17 Pro Max（CSS 视口 440 × 956） | — |
| 设计宽度 `DESIGN_WIDTH` | 440 | `src/lib/design-stage.ts` |
| CSS 变量 `--design-w` | `440px` | `src/app/globals.css :root` |
| 缩放系数 `--stage-scale` | 手机：`innerWidth / 440` | 由 `<head>` 内联脚本与 `DesignStage` 写到 `<html>` |
| 舞台高度 `--stage-h` | `100svh / --stage-scale`（设计像素） | `globals.css :root` |
| 弹窗锚定带 `--modal-band-h` | `800px`，弹窗在舞台顶部这段区域内居中 | `globals.css :root` |
| 宽屏保护 | 视口宽 ≥ `PHONE_MAX_WIDTH`(600) 时取 `min(w/440, h/MIN_STAGE_HEIGHT)`，舞台居中留边 | `design-stage.ts` |

- **手机**：严格按宽度缩放，横向撑满；竖向多出的空间留给背景（`body` 背景 / `CasinoBackdrop`）。
- **平板 / 桌面**：加了最小舞台高度保护，避免把内容放大到屏幕外，仅用于调试与非手机场景。
- 缩放只在 `DesignStage` 一处发生。**不要**在别处再写 `scale()` / `zoom` 去"适配屏幕"。

## 2. 在舞台内写样式的规则

舞台内的一切尺寸都以"设计像素"表达：在 440 宽机型上 1 设计像素 = 1 CSS 像素。

### 必须

- 用 `px` / `rem`（1rem = 16 设计像素）/ `%` / `em` 表示尺寸。
- 需要"屏幕宽度"时使用 `var(--design-w)`，例如牌桌高度：
  `height: calc((var(--design-w) - 1rem) * 1870 / 1536);`
- 需要"屏幕高度"时使用 `var(--stage-h)`，例如：
  `min-height: var(--stage-h);` `max-height: calc(var(--stage-h) * 0.82);`
- 安全区一律通过 `var(--safe-top|right|bottom|left)`，它们已除以缩放系数，缩放后仍精确。
- 全屏遮罩 / 弹窗继续用 `position: fixed; inset: 0;`——舞台带 `transform`，
  `fixed` 会以舞台为包含块，自然铺满舞台且被一起缩放。
- 弹窗统一使用 `.px-modal-backdrop`，**不要**自行写居中逻辑。它把面板居中在舞台顶部
  `--modal-band-h`（800 设计像素）的区域内，而不是整屏居中，因此弹窗相对牌桌的位置在
  所有屏高上一致（面板中心固定在 y = 400 设计像素）；舞台比 800 还矮时（如 iPhone SE）
  自动退化为整屏居中，避免溢出。新弹窗也不要用 portal 挂到 `document.body`，否则会脱离舞台。

### 禁止

- **禁止**在舞台内使用视口单位：`vw` `vh` `dvh` `svh` `lvh` `vmin` `vmax`。
  它们参照真实视口而不是舞台，会在不同机型上产生不一致。
- **禁止**用 `@media (max-width|min-width|max-height|min-height)` 或 Tailwind 的
  `sm:` `md:` `lg:` 响应式前缀改变布局。媒体查询按真实视口求值，会破坏一致性；
  舞台内根本不需要"响应式"，因为宽度永远是 440。
  （`prefers-reduced-motion`、`orientation` 这类非尺寸媒体查询可以用。）
- **禁止**用 `clamp(a, Nvw, b)` 做"流体尺寸"。请直接换算成 440 宽下的固定值：
  `clamp(2.35rem, 11vw, 3.6rem)` → 11vw = 48.4px = **3.025rem**。
- **禁止**用 JS 读 `window.innerWidth/innerHeight` 来推算元素尺寸（`design-stage.ts` 除外）。
  需要坐标时用元素自身的 `getBoundingClientRect()` 换算比例，或使用百分比定位。

### 页面内容一律顶部锚定

牌桌页（`.lobby-table-shell { padding-top: 8rem }`）和首页（`.home-lobby-content { padding-top: 7.5rem }`）
的内容都从舞台顶部固定偏移开始排布，**不要**用 `justify-center` / `margin: auto` 之类依赖舞台高度的
垂直居中——舞台高度随机型和浏览器 UI 变化，居中会让内容在不同屏幕上上下漂移，也会让锚定在固定
纵坐标的弹窗与页面内容错位。竖向多出的空间留给背景即可。

### 座位等相对牌桌的定位

座位坐标在 `src/lib/seat-layout.ts` 中是相对牌桌板的 0–1 归一化值，渲染成
`left/top: N%`。这是推荐模式：相对父容器的百分比 + 固定设计像素的元素尺寸。

## 3. 舞台外的元素

`src/app/layout.tsx` 中，只有 `OrientationPrompt`（横屏提示遮罩）和 `<head>` 内联脚本在
舞台之外；`html, body` 的 `100svh` 也是舞台外的真实视口尺寸，属于预期。新增的
全局遮罩若必须覆盖真实屏幕（例如横屏黑屏），才放到舞台外，否则一律放进 `children`。

## 4. 修改基准机型时

1. 改 `DESIGN_WIDTH`（`src/lib/design-stage.ts`）和 `--design-w`（`globals.css`）。
2. 重新换算所有由 `vw` 折算而来的固定值（本文第 2 节示例）。
3. 运行 `npm run test:stage`。
4. 用真机或 DevTools 设备模拟在基准机型上确认与改动前一致。

## 5. 验证清单

每次布局调整后：

- `rg -n '\d(vw|vh|dvh|svh|vmin|vmax)\b' src` 只应命中 `globals.css` 中的
  `html, body` 与 `--stage-h` 定义，以及 `next/image` 的 `sizes` 提示。
- `rg -n '@media \((max|min)-(width|height)' src` 应无结果；`rg -n '\b(sm|md|lg):' src` 应无结果。
- `npm run test:stage && npm run test:layout` 通过。
- 至少在 440×956（基准）、390×844、360×800、375×667 四个尺寸下截图对比，构图应一致；
  注意 macOS 上 headless Chrome 的 `--window-size` 最小宽度为 500，精确视口请用
  puppeteer `page.setViewport()` 或 DevTools 设备模拟。
