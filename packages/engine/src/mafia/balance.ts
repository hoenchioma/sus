import { ROLE_IDS, ROLES, teamOf, type RoleId } from './roles';
import { effectiveRules, type RoleCounts, type RuleChoices } from './rules';

export type Band =
  | 'strongly-village'
  | 'leans-village'
  | 'balanced'
  | 'leans-mafia'
  | 'strongly-mafia';

export type ThreatLevel = 'none' | 'medium' | 'high' | 'very-high';

export interface BalanceItem {
  label: string;
  points: number;
}

export interface Balance {
  score: number;
  band: Band;
  breakdown: BalanceItem[];
  neutralThreat: ThreatLevel;
  warnings: string[];
}

const count = (roles: RoleCounts, role: RoleId) => roles[role] ?? 0;
const total = (roles: RoleCounts) => Object.values(roles).reduce((a, b) => a + (b ?? 0), 0);

export function rolePoints(role: RoleId, rules: RuleChoices, roles: RoleCounts): number {
  const r = effectiveRules(rules, roles);
  if (role === 'godfather' && r.godfatherInnocent) return -11;
  return ROLES[role].points;
}

export function score(roles: RoleCounts, chosen: RuleChoices): { score: number; breakdown: BalanceItem[] } {
  const rules = effectiveRules(chosen, roles);
  const breakdown: BalanceItem[] = [];

  for (const role of ROLE_IDS) {
    const n = count(roles, role);
    if (n && teamOf(role) !== 'neutral') {
      breakdown.push({ label: role, points: n * rolePoints(role, chosen, roles) });
    }
  }

  // Weights are fitted to simulated games on a ×2 scale (a Villager is +2), so ±5 is about one Villager either way.
  const modifiers: [boolean, string, number][] = [
    [true, 'Baseline (parity rule, night-1 kills)', -1],
    [rules.deathReveal === 'none', 'Nothing revealed on death', -2],
    [rules.noKillNight1, 'No kills on night 1', 4],
    [count(roles, 'doctor') > 0 && !rules.protectorsAlternate, 'Protectors can repeat targets', 6],
    [rules.deadCanTalk, 'Dead can talk', 2],
  ];
  for (const [applies, label, points] of modifiers) if (applies) breakdown.push({ label, points });

  return { score: breakdown.reduce((a, b) => a + b.points, 0), breakdown };
}

export function bandOf(score: number): Band {
  if (score > 12) return 'strongly-village';
  if (score > 5) return 'leans-village';
  if (score >= -5) return 'balanced';
  if (score >= -12) return 'leans-mafia';
  return 'strongly-mafia';
}

const LEVELS: ThreatLevel[] = ['none', 'medium', 'high', 'very-high'];
const raise = (level: ThreatLevel, by = 1) =>
  LEVELS[Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + by)]!;
const max = (a: ThreatLevel, b: ThreatLevel) => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

export function neutralThreat(roles: RoleCounts, chosen: RuleChoices): ThreatLevel {
  const rules = effectiveRules(chosen, roles);
  const small = total(roles) <= 8;
  let level: ThreatLevel = 'none';
  if (count(roles, 'jester')) level = 'medium';
  if (count(roles, 'serialKiller')) {
    let killer: ThreatLevel = small ? 'very-high' : 'high';
    if (!rules.skProtectable) killer = raise(killer);
    level = max(level, killer);
  }
  return level;
}

export function warnings(roles: RoleCounts, chosen: RuleChoices): string[] {
  const rules = effectiveRules(chosen, roles);
  const out: string[] = [];
  if (count(roles, 'doctor') && rules.doctorSelf === 'always' && !rules.protectorsAlternate) {
    out.push('The Doctor is almost impossible to kill.');
  }
  if (neutralThreat(roles, chosen) === 'very-high') {
    out.push('The neutral roles will likely dominate this game.');
  }
  if (count(roles, 'jester') && count(roles, 'serialKiller') && total(roles) <= 8) {
    out.push('Two neutral roles in a small game.');
  }
  const mafiaTeam = ROLE_IDS.filter((r) => teamOf(r) === 'mafia').reduce((a, r) => a + count(roles, r), 0);
  const n = total(roles);
  if (mafiaTeam >= 2 && Math.min(Math.ceil((n - 1 - 2 * mafiaTeam) / 2), Math.ceil((n - 2 * mafiaTeam) / 2)) <= 1 && !rules.noKillNight1) {
    out.push('A single wrong elimination can hand the Mafia the game.');
  }
  if (count(roles, 'jester') && rules.tieBreak === 'bothDie') {
    out.push('A tied runoff that includes the Jester ends the game with a Jester win.');
  }
  return out;
}

export function balance(roles: RoleCounts, chosen: RuleChoices): Balance {
  const s = score(roles, chosen);
  return {
    ...s,
    band: bandOf(s.score),
    neutralThreat: neutralThreat(roles, chosen),
    warnings: warnings(roles, chosen),
  };
}

export interface Fix {
  from: RoleId;
  to: RoleId;
  score: number;
}

/** Single role swaps (player count unchanged) that bring the score closest to 0. */
export function suggestFixes(roles: RoleCounts, chosen: RuleChoices, limit = 2): Fix[] {
  const current = Math.abs(score(roles, chosen).score);
  if (bandOf(score(roles, chosen).score) === 'balanced') return [];
  const fixes: Fix[] = [];

  for (const from of ROLE_IDS) {
    if (!count(roles, from)) continue;
    for (const to of ROLE_IDS) {
      if (to === from || teamOf(to) === 'neutral' || teamOf(from) === 'neutral') continue;
      if (ROLES[to].unique && count(roles, to)) continue;
      const next = { ...roles, [from]: count(roles, from) - 1, [to]: count(roles, to) + 1 };
      if (setupProblems(next).length) continue;
      const s = score(next, chosen).score;
      if (Math.abs(s) < current) fixes.push({ from, to, score: s });
    }
  }

  return fixes.sort((a, b) => Math.abs(a.score) - Math.abs(b.score)).slice(0, limit);
}

export function setupProblems(roles: RoleCounts): string[] {
  const players = total(roles);
  const mafia = ROLE_IDS.filter((r) => teamOf(r) === 'mafia').reduce((a, r) => a + count(roles, r), 0);
  const problems: string[] = [];
  if (players < 5) problems.push('Needs at least 5 players.');
  if (mafia === 0) problems.push('Needs at least one Mafia.');
  if (mafia * 2 >= players) problems.push('Mafia would already have half the players.');
  for (const role of ROLE_IDS) {
    if (ROLES[role].unique && count(roles, role) > 1) problems.push(`Only one ${role} allowed.`);
  }
  return problems;
}
