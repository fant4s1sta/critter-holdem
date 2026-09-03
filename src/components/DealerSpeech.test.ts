import assert from "node:assert/strict";
import {
  nextDealerSpeech,
  type DealerSpeechSigs,
} from "./DealerSpeech";

const empty: DealerSpeechSigs = { action: null, skill: null };

const deal = {
  playerId: "system",
  playerName: "系统",
  type: "deal" as const,
};

const check = {
  playerId: "p1",
  playerName: "考拉",
  type: "check" as const,
};

const skill = {
  animalId: "koala" as const,
  skillName: "装睡",
  playerId: "p1",
  playerName: "考拉",
  text: "考拉 发动了装睡",
  at: 100,
};

const afterSkill = nextDealerSpeech(empty, {
  action: deal,
  skillEvent: skill,
  actionContext: "1-preflop",
});
assert.equal(afterSkill.speech?.kind, "action");
assert.match(afterSkill.speech?.text ?? "", /发牌/);

const skillOnly = nextDealerSpeech(afterSkill.sigs, {
  action: deal,
  skillEvent: skill,
  actionContext: "1-preflop",
});
assert.equal(skillOnly.speech, undefined);

const skillFired = nextDealerSpeech(afterSkill.sigs, {
  action: deal,
  skillEvent: { ...skill, at: 200 },
  actionContext: "1-preflop",
});
assert.equal(skillFired.speech?.kind, "skill");
assert.equal(skillFired.speech?.text, "考拉 发动了装睡");

const laterAction = nextDealerSpeech(skillFired.sigs, {
  action: check,
  skillEvent: { ...skill, at: 200 },
  actionContext: "1-flop",
});
assert.equal(laterAction.speech?.kind, "action");
assert.match(laterAction.speech?.text ?? "", /过牌/);

const staleSkillPatch = nextDealerSpeech(laterAction.sigs, {
  action: check,
  skillEvent: { ...skill, at: 200 },
  actionContext: "1-flop",
});
assert.equal(staleSkillPatch.speech, undefined);

console.log("dealer speech tests passed");
