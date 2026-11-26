import { describe, expect, it } from 'vitest';
import { balance, bandOf, resolveMafiaRules, score, suggestFixes, suggestedRoles, setupProblems } from '../src';

describe('rule interactions', () => {
  it('locks dead talk and ghost votes unless nothing is revealed on death', () => {
    const full = resolveMafiaRules({ deadCanTalk: true, ghostVote: true }, {});
    expect(full.status.deadCanTalk?.kind).toBe('locked');
    expect(full.values.deadCanTalk).toBe(false);
    expect(full.values.ghostVote).toBe(false);

    const hidden = resolveMafiaRules({ deathReveal: 'none', deadCanTalk: true, ghostVote: true }, {});
    expect(hidden.values.deadCanTalk).toBe(true);
    expect(hidden.values.ghostVote).toBe(true);
  });

  it('switches ghost votes off when dead talk is turned off', () => {
    const r = resolveMafiaRules({ deathReveal: 'none', deadCanTalk: false, ghostVote: true }, {});
    expect(r.status.ghostVote?.kind).toBe('locked');
    expect(r.values.ghostVote).toBe(false);
  });

  it('locks "looks innocent" without a Detective and hides rules for roles not in play', () => {
    const r = resolveMafiaRules({ godfatherInnocent: true }, { godfather: 1, villager: 4 });
    expect(r.status.godfatherInnocent?.kind).toBe('locked');
    expect(r.values.godfatherInnocent).toBe(false);
    expect(r.status.doctorSelf?.kind).toBe('hidden');
    expect(r.status.jesterEnds?.kind).toBe('hidden');
  });
});

describe('balance', () => {
  it('scores roles plus rule modifiers', () => {
    expect(score({ mafia: 2, detective: 1, doctor: 1, villager: 4 }, {}).score).toBe(-12 + 7 + 4 + 4 + 2);
  });

  it('keeps every suggested setup balanced and valid', () => {
    for (let n = 5; n <= 15; n++) {
      const roles = suggestedRoles(n);
      expect(Object.values(roles).reduce((a, b) => a + (b ?? 0), 0)).toBe(n);
      expect(setupProblems(roles)).toEqual([]);
      expect(bandOf(score(roles, {}).score)).toBe('balanced');
    }
  });

  it('scores neutral roles separately as a threat level', () => {
    const small = balance({ mafia: 1, serialKiller: 1, villager: 4 }, {});
    expect(small.breakdown.some((b) => b.label === 'serialKiller')).toBe(false);
    expect(small.neutralThreat).toBe('very-high');
    expect(balance({ mafia: 2, jester: 1, villager: 7 }, {}).neutralThreat).toBe('medium');
  });

  it('suggests swaps that move the score toward 0 without changing the player count', () => {
    const roles = { mafia: 1, detective: 1, doctor: 1, villager: 5 };
    const before = Math.abs(score(roles, {}).score);
    const fixes = suggestFixes(roles, {});
    expect(fixes.length).toBeGreaterThan(0);
    for (const fix of fixes) expect(Math.abs(fix.score)).toBeLessThan(before);
  });

  it('warns about a nearly unkillable Doctor and a Jester in a both-die runoff', () => {
    const w = balance({ mafia: 2, doctor: 1, jester: 1, villager: 6 }, { protectorsAlternate: false }).warnings;
    expect(w).toContain('The Doctor is almost impossible to kill.');
    expect(w).toContain('A tied runoff that includes the Jester ends the game with a Jester win.');
  });
});
