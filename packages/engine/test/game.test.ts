import { describe, expect, it } from 'vitest';
import { goTo, newGame, replay, rulesOf, setStep, view, voteInfo, winnerOf, type Step } from '../src';
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

const finalState = (setup: ReturnType<typeof makeSetup>, steps: Step[]) => replay(setup, steps).states.at(-1)!;

describe('day votes', () => {
  it("counts votes needed and blocks the Lover's partner from voting", () => {
    const setup = makeSetup(base);
    const state = finalState(setup, [{ kind: 'night', actions: { mafia: 'gu', lover: 'ha' } }]);
    const info = voteInfo(setup, state, rulesOf(setup));
    expect(info.alive).toBe(7);
    expect(info.blockedPartner).toBe('ha');
    expect(info.votes).toBe(6);
    expect(info.needed).toBe(4);
  });

  it('counts a revealed Mayor twice', () => {
    const setup = makeSetup({ ...base, ha: 'mayor' });
    const state = finalState(setup, [
      { kind: 'night', actions: {} },
      { kind: 'day', eliminated: [], mayorRevealed: true },
    ]);
    expect(voteInfo(setup, state, rulesOf(setup)).votes).toBe(9);
  });

  it('offers ghost votes but keeps the threshold based on the living', () => {
    const setup = makeSetup(base, { deathReveal: 'none', deadCanTalk: true, ghostVote: true });
    const state = finalState(setup, [{ kind: 'night', actions: { mafia: 'gu' } }]);
    const info = voteInfo(setup, state, rulesOf(setup));
    expect(info.ghostsAvailable).toEqual(['gu']);
    expect(info.needed).toBe(4);
  });

  it('only takes the partner on a day execution when that rule is on', () => {
    const steps: Step[] = [
      { kind: 'night', actions: { lover: 'gu' } },
      { kind: 'day', eliminated: ['fa'] },
    ];
    expect(finalState(makeSetup(base), steps).alive.gu).toBe(true);
    expect(finalState(makeSetup(base, { loverDayDeath: true }), steps).alive.gu).toBe(false);
  });
});

describe('win checks', () => {
  it('gives the Village the win when every Mafia is dead', () => {
    const setup = makeSetup(base);
    const state = finalState(setup, [
      { kind: 'night', actions: {} },
      { kind: 'day', eliminated: ['ali', 'bo'] },
    ]);
    expect(winnerOf(setup, state, rulesOf(setup))).toBe('village');
  });

  it('gives the Mafia the win at parity', () => {
    const setup = makeSetup({ ali: 'mafia', bo: 'mafia', cy: 'villager', di: 'villager', ed: 'villager' });
    const state = finalState(setup, [{ kind: 'night', actions: { mafia: 'cy' } }]);
    expect(winnerOf(setup, state, rulesOf(setup))).toBe('mafia');
  });

  it('blocks every other win while the Serial Killer lives', () => {
    const setup = makeSetup({ ali: 'mafia', sk: 'serialKiller', cy: 'villager', di: 'villager', ed: 'villager' });
    const rules = rulesOf(setup);
    const noMafia = finalState(setup, [{ kind: 'night', actions: { serialKiller: 'ali' } }]);
    expect(winnerOf(setup, noMafia, rules)).toBeNull();
    const oneOnOne = finalState(setup, [
      { kind: 'night', actions: { serialKiller: 'ali' } },
      { kind: 'day', eliminated: ['cy', 'di'] },
    ]);
    expect(winnerOf(setup, oneOnOne, rules)).toBe('serialKiller');
  });

  it('ends the game when the Jester is voted out, unless that rule is off', () => {
    const roles = { ...base, ha: 'jester' } as const;
    const steps: Step[] = [{ kind: 'night', actions: {} }, { kind: 'day', eliminated: ['ha'] }];
    const ends = makeSetup(roles);
    expect(winnerOf(ends, finalState(ends, steps), rulesOf(ends))).toBe('jester');
    const goesOn = makeSetup(roles, { jesterEnds: false });
    const state = finalState(goesOn, steps);
    expect(state.jesterWon).toBe(true);
    expect(winnerOf(goesOn, state, rulesOf(goesOn))).toBeNull();
  });
});

describe('back / edit / replay', () => {
  it('recomputes later steps and flags ones that no longer make sense', () => {
    const setup = makeSetup(base);
    let game = newGame(setup);
    game = setStep(game, 0, { kind: 'night', actions: { mafia: 'gu' } });
    game = goTo(game, 1);
    game = setStep(game, 1, { kind: 'day', eliminated: ['ha'] });
    game = goTo(game, 2);
    expect(view(game).state.alive.gu).toBe(false);

    game = goTo(game, 0);
    game = setStep(game, 0, { kind: 'night', actions: { mafia: 'ha' } });
    const v = view(game);
    expect(v.after.alive.gu).toBe(true);
    expect(v.issues).toEqual([{ step: 1, message: 'Eliminated player was already dead' }]);
    expect(game.steps).toHaveLength(3);
  });

  it('applies host overrides of night deaths and manual adjustments', () => {
    const setup = makeSetup(base);
    const state = finalState(setup, [
      { kind: 'night', actions: { mafia: 'gu' }, overrideDeaths: [], adjust: { ha: false } },
    ]);
    expect(state.alive.gu).toBe(true);
    expect(state.alive.ha).toBe(false);
    expect(state.deaths).toEqual([{ player: 'ha', cause: 'host', step: 0 }]);
  });
});
