import { effectiveQuestRules, type QuestRuleChoices } from './rules';
import { isExperimental } from './tables';

export interface QuestBalance {
  /** Positive favours the good side. */
  score: number;
  breakdown: { label: string; points: number }[];
  warnings: string[];
}

// Per-player-count base values stay 0 until playtests say otherwise.
const BASE: Record<number, number> = {};

export function questBalance(chosen: QuestRuleChoices, players: number): QuestBalance {
  const rules = effectiveQuestRules(chosen, players);
  const items: [boolean, string, number][] = [
    [rules.percival, 'percival', 2],
    [rules.morgana, 'morgana', -2],
    [rules.mordred, 'mordred', -2],
    [rules.oberon, 'oberon', 1],
    [rules.lady, 'lady', players < 7 ? 3 : 2],
  ];
  const breakdown = items.filter(([on]) => on).map(([, label, points]) => ({ label, points }));
  const base = BASE[players] ?? 0;
  if (base) breakdown.unshift({ label: 'base', points: base });

  const warnings: string[] = [];
  if (rules.oberon && players <= 6) warnings.push('oberonSmall');
  if (rules.lady && players < 7) warnings.push('ladySmall');
  if (isExperimental(players)) warnings.push('experimental');

  return { score: breakdown.reduce((a, b) => a + b.points, 0), breakdown, warnings };
}
