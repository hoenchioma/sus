import type { RoleId, RuleChoices, Setup } from '../src';

/** `makeSetup({ ali: 'mafia', sara: 'doctor', ... })` — player ids double as names. */
export function makeSetup(roles: Record<string, RoleId>, rules: RuleChoices = {}): Setup {
  return {
    players: Object.keys(roles).map((id) => ({ id, name: id })),
    roles,
    rules,
  };
}
