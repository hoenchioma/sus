import { resolveRules, type ResolvedRules, type RuleDef, type RuleValue } from '../core/rules';
import type { RoleId } from './roles';

export type RoleCounts = Partial<Record<RoleId, number>>;

export interface RuleCtx {
  rules: Record<string, RuleValue>;
  roles: RoleCounts;
}

const has = (ctx: RuleCtx, ...roles: RoleId[]) => roles.some((r) => (ctx.roles[r] ?? 0) > 0);

export const RULE_DEFS: RuleDef<RuleCtx>[] = [
  {
    id: 'deathReveal',
    label: 'Role revealed on death',
    options: [
      { value: 'full', label: 'Full role' },
      { value: 'team', label: 'Team only' },
      { value: 'none', label: 'Nothing' },
    ],
    default: 'full',
  },
  {
    id: 'protectorsAlternate',
    label: 'Protectors must alternate',
    description: "Doctor, Bodyguard and Lover can't pick the same player two nights in a row (themselves included).",
    options: [
      { value: true, label: 'On' },
      { value: false, label: 'Off' },
    ],
    default: true,
    appliesIf: (c) => has(c, 'doctor', 'bodyguard', 'lover'),
  },
  {
    id: 'doctorSelf',
    label: 'Doctor can protect themselves',
    options: [
      { value: 'always', label: 'Always' },
      { value: 'once', label: 'Once per game' },
      { value: 'never', label: 'Never' },
    ],
    default: 'always',
    appliesIf: (c) => has(c, 'doctor'),
  },
  {
    id: 'loverSelf',
    label: 'Lover can protect themselves',
    options: [
      { value: false, label: 'No' },
      { value: true, label: 'Yes' },
    ],
    default: false,
    appliesIf: (c) => has(c, 'lover'),
  },
  {
    id: 'loverDayDeath',
    label: 'Partner dies when the Lover is voted out',
    description: "Off: only the Lover's night deaths take the partner with them.",
    options: [
      { value: false, label: 'No' },
      { value: true, label: 'Yes' },
    ],
    default: false,
    appliesIf: (c) => has(c, 'lover'),
  },
  {
    id: 'noKillNight1',
    label: 'No kills on night 1',
    options: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
    default: false,
  },
  {
    id: 'skProtectable',
    label: 'Protection stops the Serial Killer',
    options: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    default: true,
    appliesIf: (c) => has(c, 'serialKiller'),
  },
  {
    id: 'godfatherInnocent',
    label: 'Godfather looks innocent to the Detective',
    options: [
      { value: false, label: 'No' },
      { value: true, label: 'Yes' },
    ],
    default: false,
    appliesIf: (c) => has(c, 'godfather'),
    lockedUnless: (c) => (has(c, 'detective') ? null : 'Needs a Detective in play'),
  },
  {
    id: 'votesNeeded',
    label: 'Votes needed to eliminate',
    options: [
      { value: 'majority', label: 'Strict majority' },
      { value: 'half', label: 'At least half' },
      { value: 'plurality', label: 'Most votes' },
    ],
    default: 'majority',
  },
  {
    id: 'tieBreak',
    label: 'If the runoff is still tied',
    description: 'No majority or a tie leads to a runoff between the top two first.',
    options: [
      { value: 'bothDie', label: 'Both die' },
      { value: 'host', label: 'Host picks' },
      { value: 'random', label: 'Random' },
      { value: 'nobody', label: 'Nobody dies' },
    ],
    default: 'bothDie',
  },
  {
    id: 'jesterEnds',
    label: 'Voting out the Jester',
    options: [
      { value: true, label: 'Ends the game' },
      { value: false, label: 'Jester wins, game goes on' },
    ],
    default: true,
    appliesIf: (c) => has(c, 'jester'),
  },
  {
    id: 'deadRoleReminder',
    label: 'Still call dead roles at night',
    description: "Auto: on unless dead players' roles are fully revealed.",
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
    ],
    default: 'auto',
  },
  {
    id: 'deadCanTalk',
    label: 'Dead players can talk',
    options: [
      { value: false, label: 'No' },
      { value: true, label: 'Yes' },
    ],
    default: false,
    lockedUnless: (c) =>
      c.rules.deathReveal === 'none' ? null : 'Only when nothing is revealed on death',
  },
  {
    id: 'ghostVote',
    label: 'Ghost vote (one use each)',
    options: [
      { value: false, label: 'Off' },
      { value: true, label: 'On' },
    ],
    default: false,
    lockedUnless: (c) => (c.rules.deadCanTalk === true ? null : 'Needs "Dead players can talk"'),
  },
];

export interface Rules {
  deathReveal: 'full' | 'team' | 'none';
  protectorsAlternate: boolean;
  doctorSelf: 'always' | 'once' | 'never';
  loverSelf: boolean;
  loverDayDeath: boolean;
  noKillNight1: boolean;
  skProtectable: boolean;
  godfatherInnocent: boolean;
  votesNeeded: 'majority' | 'half' | 'plurality';
  tieBreak: 'bothDie' | 'host' | 'random' | 'nobody';
  jesterEnds: boolean;
  deadRoleReminder: 'auto' | 'on' | 'off';
  deadCanTalk: boolean;
  ghostVote: boolean;
}

export type RuleChoices = Partial<Rules>;

export function resolveMafiaRules(chosen: RuleChoices, roles: RoleCounts): ResolvedRules {
  return resolveRules(RULE_DEFS, chosen as Record<string, RuleValue>, (values) => ({ rules: values, roles }));
}

export function effectiveRules(chosen: RuleChoices, roles: RoleCounts): Rules {
  return resolveMafiaRules(chosen, roles).values as unknown as Rules;
}

export const callDeadRoles = (rules: Rules) =>
  rules.deadRoleReminder === 'auto' ? rules.deathReveal !== 'full' : rules.deadRoleReminder === 'on';

export const PRESETS = {
  classic: { label: 'Classic', rules: {} as RuleChoices, hideComplexRoles: false },
  beginner: { label: 'Beginner', rules: {} as RuleChoices, hideComplexRoles: true },
  hidden: {
    label: 'Hidden roles',
    rules: { deathReveal: 'none', deadCanTalk: true, ghostVote: true } as RuleChoices,
    hideComplexRoles: false,
  },
} as const;

export type PresetId = keyof typeof PRESETS;
