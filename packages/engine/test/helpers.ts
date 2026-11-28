import { expect } from 'vitest';
import type { GameRecord, RoleId, RuleChoices, Setup } from '../src';

/** `makeSetup({ ali: 'mafia', sara: 'doctor', ... })` — player ids double as names. */
export function makeSetup(roles: Record<string, RoleId>, rules: RuleChoices = {}): Setup {
  return {
    players: Object.keys(roles).map((id) => ({ id, name: id })),
    roles,
    rules,
  };
}

/** A stats record must not carry names, player IDs or rejoin tokens anywhere but the seat name the server hashes. */
export function expectAnonymous(record: GameRecord, members: { id: string; name: string; token?: string }[]) {
  const stored = JSON.stringify({ ...record, seats: record.seats.map(({ name: _, ...seat }) => seat) });
  for (const m of members) {
    for (const secret of [m.id, m.name, m.token]) {
      if (secret && stored.includes(JSON.stringify(secret))) throw new Error(`record leaks ${secret}`);
    }
  }
  expect(record.seats.map((s) => s.seat)).toEqual(record.seats.map((_, i) => i));
  if (record.winner !== 'none' && record.winner !== 'draw') expect(record.seats.some((s) => s.won)).toBe(true);
  if (record.winner === 'none') expect(record.seats.some((s) => s.won)).toBe(false);
}
