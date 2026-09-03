"use client";

import { useEffect, useState } from "react";
import type { SkillPublicState, TexasHoldemPublicState } from "@/lib/types";

type LastAction = NonNullable<TexasHoldemPublicState["lastAction"]>;
type SkillEvent = NonNullable<SkillPublicState["lastSkillEvent"]>;

type Speech =
  | { kind: "action"; key: string; text: string }
  | { kind: "skill"; key: string; text: string };

function actionLabel(type: LastAction["type"]) {
  switch (type) {
    case "fold":
      return "弃牌";
    case "check":
      return "过牌";
    case "call":
      return "跟注";
    case "bet":
      return "下注";
    case "raise":
      return "加注";
    case "all-in":
      return "全下";
    case "blind":
      return "盲注";
    case "deal":
      return "发牌";
    default:
      return type;
  }
}

export function formatDealerLine(action: LastAction): string {
  if (action.type === "deal") {
    return "发牌啦，各位看牌！";
  }
  const who = `${action.playerName}${action.ai ? "(AI)" : ""}`;
  const verb = actionLabel(action.type);
  const amount =
    action.amount != null && action.amount > 0 ? ` ${action.amount}` : "";
  return `${who} ${verb}${amount}`;
}

function actionKey(action: LastAction) {
  return `a:${action.playerId}-${action.type}-${action.amount ?? 0}-${action.playerName}`;
}

function skillKey(event: SkillEvent) {
  return `s:${event.playerId}-${event.skillName}-${event.text}`;
}

export function DealerSpeech({
  action,
  skillEvent,
}: {
  action?: LastAction | null;
  skillEvent?: SkillEvent | null;
}) {
  const [speech, setSpeech] = useState<Speech | null>(null);

  useEffect(() => {
    if (!action) return;
    setSpeech({
      kind: "action",
      key: actionKey(action),
      text: formatDealerLine(action),
    });
  }, [action]);

  useEffect(() => {
    if (!skillEvent) return;
    setSpeech({
      kind: "skill",
      key: skillKey(skillEvent),
      text: skillEvent.text,
    });
  }, [skillEvent]);

  if (!speech) return null;

  return (
    <p
      key={speech.key}
      className={`dealer-speech${speech.kind === "skill" ? " is-skill" : ""}`}
      role="status"
      aria-live="polite"
    >
      {speech.text}
    </p>
  );
}
