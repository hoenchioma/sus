import { ROLE_IDS, type RoleId } from './roles';
import type { RoleCounts } from './rules';
import type { Player, PlayerId } from './types';

type Mix = Partial<Record<RoleId, number>>;

// Tuned so each scores within ±3 under the Classic rules (full reveal adds +2).
const SUGGESTED: Record<number, Mix> = {
  5: { mafia: 1, doctor: 1, villager: 3 },
  6: { mafia: 2, detective: 1, doctor: 1, villager: 2 },
  7: { godfather: 1, mafia: 1, detective: 1, doctor: 1, villager: 3 },
  8: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, villager: 2 },
  9: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, villager: 3 },
  10: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, villager: 4 },
  11: { godfather: 1, mafia: 2, detective: 1, doctor: 1, bodyguard: 1, lover: 1, villager: 4 },
  12: { godfather: 1, mafia: 2, roleblocker: 1, detective: 1, doctor: 1, bodyguard: 1, lover: 1, vigilante: 1, villager: 3 },
  13: { godfather: 1, mafia: 2, roleblocker: 1, detective: 1, doctor: 1, bodyguard: 1, lover: 1, vigilante: 1, villager: 4 },
  14: { godfather: 1, mafia: 2, roleblocker: 1, detective: 1, doctor: 1, bodyguard: 1, lover: 1, vigilante: 1, villager: 5 },
  15: { godfather: 1, mafia: 2, roleblocker: 1, detective: 1, doctor: 1, bodyguard: 1, lover: 1, vigilante: 1, mayor: 1, villager: 5 },
};

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
