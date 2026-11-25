import { effectiveQuestRules, type QuestRuleChoices } from './rules';
import { isExperimental } from './tables';

export interface QuestBalance {
  /** Positive favours the good side. */
  score: number;
  breakdown: { label: string; points: number }[];
  warnings: string[];
}

// From simulated games (1 point ≈ 2.5 points of good win rate, 0 ≈ 50%). Small games lean slightly good.
const BASE: Record<number, number> = { 5: 2, 6: 1, 7: 1 };

export function questBalance(chosen: QuestRuleChoices, players: number): QuestBalance {
  const rules = effectiveQuestRules(chosen, players);
  // Oberon helps evil (good loses its vote-reading signal and Merlin stands out); Mordred roughly cancels out.
  const items: [boolean, string, number][] = [
    [rules.percival, 'percival', players <= 10 ? 4 : 2],
    [rules.morgana, 'morgana', -2],
    [rules.mordred, 'mordred', 0],
    [rules.oberon, 'oberon', players <= 6 ? -2 : players <= 9 ? -5 : -6],
    [rules.lady, 'lady', 2],
  ];
  const breakdown = items.filter(([on]) => on).map(([, label, points]) => ({ label, points }));
  const base = BASE[players] ?? 0;
  if (base) breakdown.unshift({ label: 'base', points: base });

  const warnings: string[] = [];
  if (rules.oberon && players >= 7) warnings.push('oberonStrong');
  if (rules.lady && players < 7) warnings.push('ladySmall');
  if (isExperimental(players)) warnings.push('experimental');

  return { score: breakdown.reduce((a, b) => a + b.points, 0), breakdown, warnings };
}
