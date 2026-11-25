import { resolveRules, type ResolvedRules, type RuleDef, type RuleValue } from '../core/rules';
import { evilPowerCap } from './tables';

export interface QuestRuleCtx {
  rules: Record<string, RuleValue>;
  players: number;
}

const evilPowersBefore = (c: QuestRuleCtx, ids: string[]) => ids.filter((id) => c.rules[id] === true).length;

/** Morgana, Mordred and Oberon share a seat cap; each is locked once the earlier ones fill it. */
const seatLock = (earlier: string[]) => (c: QuestRuleCtx) =>
  evilPowersBefore(c, earlier) >= evilPowerCap(c.players)
    ? `Only ${evilPowerCap(c.players)} extra evil power${evilPowerCap(c.players) > 1 ? 's' : ''} fit at ${c.players} players`
    : null;

const onOff = [
  { value: false, label: 'Off' },
  { value: true, label: 'On' },
];

export const QUEST_RULE_DEFS: RuleDef<QuestRuleCtx>[] = [
  { id: 'percival', label: 'percival', options: onOff, default: false },
  {
    id: 'morgana',
    label: 'morgana',
    options: onOff,
    default: false,
    lockedUnless: (c) => (c.rules.percival === true ? seatLock([])(c) : 'Only fools Percival, so turn Percival on first'),
  },
  { id: 'mordred', label: 'mordred', options: onOff, default: false, lockedUnless: seatLock(['morgana']) },
  { id: 'oberon', label: 'oberon', options: onOff, default: false, lockedUnless: seatLock(['morgana', 'mordred']) },
  { id: 'lady', label: 'lady', options: onOff, default: false },
  {
    id: 'firstCommander',
    label: 'firstCommander',
    options: [
      { value: 'random', label: 'Random' },
      { value: 'host', label: 'Host picks' },
    ],
    default: 'random',
  },
  { id: 'anonymousVotes', label: 'anonymousVotes', options: onOff, default: false },
];

export interface QuestRules {
  percival: boolean;
  morgana: boolean;
  mordred: boolean;
  oberon: boolean;
  lady: boolean;
  firstCommander: 'random' | 'host';
  anonymousVotes: boolean;
}

export type QuestRuleChoices = Partial<QuestRules>;

export function resolveQuestRules(chosen: QuestRuleChoices, players: number): ResolvedRules {
  return resolveRules(QUEST_RULE_DEFS, chosen as Record<string, RuleValue>, (values) => ({ rules: values, players }));
}

export const effectiveQuestRules = (chosen: QuestRuleChoices, players: number) =>
  resolveQuestRules(chosen, players).values as unknown as QuestRules;

export const QUEST_PRESETS = {
  first: { label: 'firstGame', rules: {} as QuestRuleChoices },
  classic: { label: 'classic', rules: { percival: true, morgana: true } as QuestRuleChoices },
  full: { label: 'full', rules: { percival: true, morgana: true, mordred: true, oberon: true, lady: true } as QuestRuleChoices },
} as const;

export type QuestPresetId = keyof typeof QUEST_PRESETS;
