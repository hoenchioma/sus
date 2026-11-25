import { ROLE_IDS, type RoleId } from './roles';
import type { RoleCounts, RuleChoices } from './rules';
import type { Player, PlayerId } from './types';

type Mix = Partial<Record<RoleId, number>>;

// Validated in simulated games (about 40–60% Village wins at middling read skill). 6, 10 and 15 players
// also need "No kills on night 1" to get there, which suggestedRules returns.
const SUGGESTED: Record<number, Mix> = {
  5: { mafia: 1, doctor: 1, villager: 3 },
  6: { mafia: 2, detective: 1, doctor: 1, villager: 2 },
  7: { godfather: 1, mafia: 1, detective: 1, doctor: 1, lover: 1, villager: 2 },
  8: { godfather: 1, mafia: 1, detective: 1, doctor: 1, villager: 4 },
  9: { godfather: 1, mafia: 1, detective: 1, villager: 6 },
  10: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, lover: 1, mayor: 1, villager: 2 },
  11: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, lover: 1, mayor: 1, villager: 3 },
  12: { godfather: 1, roleblocker: 1, mafia: 1, detective: 1, doctor: 1, lover: 1, vigilante: 1, villager: 5 },
  13: { godfather: 1, roleblocker: 1, mafia: 1, detective: 1, doctor: 1, bodyguard: 1, lover: 1, villager: 6 },
  14: { godfather: 1, roleblocker: 1, mafia: 1, detective: 1, doctor: 1, bodyguard: 1, villager: 8 },
  15: { godfather: 1, mafia: 3, detective: 1, doctor: 1, bodyguard: 1, lover: 1, vigilante: 1, mayor: 1, villager: 5 },
};

const NO_KILL_NIGHT_1 = new Set([6, 10, 15]);

/** Rule settings that go with the suggested mix for this many players (applied together with it). */
export function suggestedRules(players: number): RuleChoices {
  return { noKillNight1: NO_KILL_NIGHT_1.has(Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, players))) };
}

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

export function suggestedRoles(players: number): RoleCounts {
  const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, players));
  const mix: RoleCounts = { ...SUGGESTED[n] };
  if (players > MAX_PLAYERS) mix.villager = (mix.villager ?? 0) + players - MAX_PLAYERS;
  return mix;
}

export function rolesList(counts: RoleCounts): RoleId[] {
  return ROLE_IDS.flatMap((role) => Array<RoleId>(counts[role] ?? 0).fill(role));
}

export function dealRoles(players: Player[], counts: RoleCounts, random = Math.random): Record<PlayerId, RoleId> {
  const deck = rolesList(counts);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return Object.fromEntries(players.map((p, i) => [p.id, deck[i] ?? 'villager']));
}
