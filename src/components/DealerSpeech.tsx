"use client";

import { useEffect, useRef, useState } from "react";
import type { SkillPublicState, TexasHoldemPublicState } from "@/lib/types";

type LastAction = NonNullable<TexasHoldemPublicState["lastAction"]>;
type SkillEvent = NonNullable<SkillPublicState["lastSkillEvent"]>;

type Speech =
  | { kind: "action"; key: string; text: string }
  | { kind: "skill"; key: string; text: string };

export type DealerSpeechSigs = {
  action: string | null;
  skill: string | null;
};

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

export function actionSpeechSig(
  action: LastAction | null | undefined,
  context = "",
) {
  if (!action) return null;
  return `${context}|${action.playerId}|${action.type}|${action.amount ?? ""}|${action.playerName}|${action.ai ? 1 : 0}`;
}

export function skillSpeechSig(event: SkillEvent | null | undefined) {
  if (!event) return null;
  return `${event.at ?? ""}|${event.playerId}|${event.skillName}|${event.text}`;
}

/**
 * Skill patches reuse the last skill event object, so a later action must
 * win once it changes. If both signatures are new (first paint / same tick),
 * keep the ordinary action so reconnects don't stick on an old skill line.
 */
export function nextDealerSpeech(
  prev: DealerSpeechSigs,
  input: {
    action?: LastAction | null;
    skillEvent?: SkillEvent | null;
    actionContext?: string;
  },
): { sigs: DealerSpeechSigs; speech?: Speech } {
  const action = actionSpeechSig(input.action, input.actionContext);
  const skill = skillSpeechSig(input.skillEvent);
  const sigs = { action, skill };
  const actionIsNew = action != null && action !== prev.action;
  const skillIsNew = skill != null && skill !== prev.skill;

  if (skillIsNew && !actionIsNew && input.skillEvent) {
    return {
      sigs,
      speech: {
        kind: "skill",
        key: `s:${skill}`,
        text: input.skillEvent.text,
      },
    };
  }
  if (actionIsNew && input.action) {
    return {
      sigs,
      speech: {
        kind: "action",
        key: `a:${action}`,
        text: formatDealerLine(input.action),
      },
    };
  }
  return { sigs };
}

export function DealerSpeech({
  action,
  skillEvent,
  actionContext = "",
}: {
  action?: LastAction | null;
  skillEvent?: SkillEvent | null;
  actionContext?: string;
}) {
  const [speech, setSpeech] = useState<Speech | null>(null);
  const sigsRef = useRef<DealerSpeechSigs>({ action: null, skill: null });

  useEffect(() => {
    const next = nextDealerSpeech(sigsRef.current, {
      action,
      skillEvent,
      actionContext,
    });
    sigsRef.current = next.sigs;
    if (next.speech) setSpeech(next.speech);
  }, [action, skillEvent, actionContext]);

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
