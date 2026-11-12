import { createRoot } from "react-dom/client";
import { AppShell } from "./components/AppShell";
import { DesignStage } from "./components/DesignStage";
import { applyStageScale } from "./lib/design-stage";
import "./styles.css";

applyStageScale();
createRoot(document.getElementById("root")!).render(
  <>
    <DesignStage><AppShell /></DesignStage>
    <aside className="orientation-prompt">请旋转手机，竖屏体验更佳</aside>
  </>,
);
