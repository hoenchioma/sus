import { describe, expect, it } from 'vitest';
import { initialState, replay, resolveNight, rulesOf, targetProblem, type NightActions, type Setup } from '../src';
import { makeSetup } from './helpers';

const base = {
  ali: 'mafia',
  bo: 'godfather',
  cy: 'doctor',
  di: 'detective',
  ed: 'bodyguard',
  fa: 'lover',
  gu: 'villager',
  ha: 'villager',
} as const;

function night(setup: Setup, actions: NightActions, n = 1) {
  return resolveNight(setup, initialState(setup), n, actions, rulesOf(setup));
}

const dead = (result: ReturnType<typeof night>) => result.deaths.map((d) => d.player).sort();

describe('resolveNight', () => {
  it('kills the Mafia target', () => {
    expect(dead(night(makeSetup(base), { mafia: 'gu' }))).toEqual(['gu']);
  });

  it('lets the Doctor save the Mafia target', () => {
    const result = night(makeSetup(base), { mafia: 'gu', doctor: 'gu' });
    expect(dead(result)).toEqual([]);
    expect(result.events).toContainEqual({ type: 'attack', by: 'mafia', target: 'gu', outcome: 'saved', savedBy: 'doctor' });
  });

  it('makes the Bodyguard die instead of the guarded player', () => {
    const result = night(makeSetup(base), { mafia: 'gu', bodyguard: 'gu' });
    expect(result.deaths).toEqual([{ player: 'ed', cause: 'guarding' }]);
  });

  it('lets the Doctor save a Bodyguard who took the hit', () => {
    expect(dead(night(makeSetup(base), { mafia: 'gu', bodyguard: 'gu', doctor: 'ed' }))).toEqual([]);
  });

  it('lets the Lover protect their partner and reveals the partner', () => {
    const result = night(makeSetup(base), { mafia: 'gu', lover: 'gu' });
    expect(dead(result)).toEqual([]);
    expect(result.events).toContainEqual({ type: 'partner', partner: 'gu' });
  });

  it('takes the partner when the Lover dies at night', () => {
    const result = night(makeSetup(base), { mafia: 'fa', lover: 'gu' });
    expect(result.deaths).toEqual([
      { player: 'fa', cause: 'mafia' },
      { player: 'gu', cause: 'heartbreak' },
    ]);
  });

  it('cancels a roleblocked Doctor', () => {
    const setup = makeSetup({ ...base, ha: 'roleblocker' });
    const result = night(setup, { roleblocker: 'cy', mafia: 'gu', doctor: 'gu' });
    expect(dead(result)).toEqual(['gu']);
    expect(result.events).toContainEqual({ type: 'blocked', player: 'cy', key: 'doctor' });
  });

  it('shows the Godfather as Mafia unless "looks innocent" is on', () => {
    const check = (rules = {}) =>
      night(makeSetup(base, rules), { detective: 'bo' }).events.find((e) => e.type === 'check');
    expect(check()).toEqual({ type: 'check', target: 'bo', result: 'mafia' });
    expect(check({ godfatherInnocent: true })).toEqual({ type: 'check', target: 'bo', result: 'innocent' });
  });

  it('resolves Mafia and Serial Killer kills on the same night', () => {
    const setup = makeSetup({ ...base, ha: 'serialKiller' });
    expect(dead(night(setup, { mafia: 'gu', serialKiller: 'ali' }))).toEqual(['ali', 'gu']);
  });

  it('respects whether protection stops the Serial Killer', () => {
    const roles = { ...base, ha: 'serialKiller' } as const;
    expect(dead(night(makeSetup(roles), { serialKiller: 'gu', doctor: 'gu' }))).toEqual([]);
    expect(dead(night(makeSetup(roles, { skProtectable: false }), { serialKiller: 'gu', doctor: 'gu' }))).toEqual(['gu']);
  });

  it('skips kills on night 1 when that rule is on', () => {
    const setup = makeSetup(base, { noKillNight1: true });
    expect(dead(night(setup, { mafia: 'gu' }, 1))).toEqual([]);
    expect(dead(night(setup, { mafia: 'gu' }, 2))).toEqual(['gu']);
  });
});

describe('targetProblem', () => {
  const setup = makeSetup(base);
  const rules = rulesOf(setup);

  it('stops protectors picking the same player two nights in a row, self included', () => {
    const after = replay(setup, [{ kind: 'night', actions: { doctor: 'cy', lover: 'gu' } }, { kind: 'day', eliminated: [] }])
      .states[2]!;
    expect(targetProblem(setup, after, 'doctor', 'cy', rules)).toBe('Picked last night');
    expect(targetProblem(setup, after, 'lover', 'gu', rules)).toBe('Picked last night');
    expect(targetProblem(setup, after, 'doctor', 'gu', rules)).toBeNull();
  });

  it('lets the Doctor always self-protect by default but not the Lover', () => {
    const state = initialState(setup);
    expect(targetProblem(setup, state, 'doctor', 'cy', rules)).toBeNull();
    expect(targetProblem(setup, state, 'lover', 'fa', rules)).toBe("Can't pick themselves");
    expect(targetProblem(setup, state, 'bodyguard', 'ed', rules)).toBe("Can't guard themselves");
  });

  it('stops the Mafia from targeting their own team', () => {
    expect(targetProblem(setup, initialState(setup), 'mafia', 'bo', rules)).toBe('Mafia');
  });
});
