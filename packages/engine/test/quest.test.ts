import { describe, expect, it } from 'vitest';
import { quest } from '../src';

const { applyQuestStep, cardFaces, dealQuest, failsNeeded, initialQuestState, knowledgeOf, questBalance, questDeck, questStepProblem, replayQuest, resolveQuestRules, ritualScript, tableFor, teamSize } = quest;
type QuestRole = quest.QuestRole;
type QuestSetup = quest.QuestSetup;
type QuestStep = quest.QuestStep;

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

function setupWith(roles: QuestRole[], rules: quest.QuestRuleChoices = {}, firstCommander = 0): QuestSetup {
  const players = ids(roles.length).map((id) => ({ id, name: id }));
  return {
    players,
    roles: Object.fromEntries(players.map((p, i) => [p.id, roles[i]!])),
    cards: {},
    rules,
    firstCommander,
  };
}

const five: QuestRole[] = ['merlin', 'servant', 'servant', 'assassin', 'minion'];

const allYes = (s: QuestSetup) => ({ kind: 'vote' as const, votes: Object.fromEntries(s.players.map((p) => [p.id, true])) });
const allNo = (s: QuestSetup) => ({ kind: 'vote' as const, votes: Object.fromEntries(s.players.map((p) => [p.id, false])) });
const play = (team: string[], betray: string[] = []) => ({
  kind: 'chapter' as const,
  plays: Object.fromEntries(team.map((id) => [id, betray.includes(id) ? ('betray' as const) : ('success' as const)])),
});

describe('quest tables', () => {
  it('matches the official 5–10 player table and the house table up to 15', () => {
    expect([5, 6, 7, 8, 9, 10].map((n) => [tableFor(n).good, tableFor(n).evil])).toEqual([[3, 2], [4, 2], [4, 3], [5, 3], [6, 3], [6, 4]]);
    expect(tableFor(13).teams).toEqual([4, 4, 5, 5, 6]);
    expect([tableFor(15).good, tableFor(15).evil]).toEqual([10, 5]);
    expect(failsNeeded(6, 4)).toBe(1);
    expect(failsNeeded(7, 4)).toBe(2);
    expect(failsNeeded(15, 4)).toBe(2);
    expect(failsNeeded(15, 5)).toBe(1);
  });
});

describe('quest rules', () => {
  it('locks Morgana unless Percival is on', () => {
    expect(resolveQuestRules({ morgana: true }, 7).status.morgana?.kind).toBe('locked');
    expect(resolveQuestRules({ percival: true, morgana: true }, 7).values.morgana).toBe(true);
  });

  it('caps the extra evil powers by player count', () => {
    const all = { percival: true, morgana: true, mordred: true, oberon: true };
    const at = (n: number) => resolveQuestRules(all, n).values;
    expect([at(5).morgana, at(5).mordred, at(5).oberon]).toEqual([true, false, false]);
    expect([at(7).morgana, at(7).mordred, at(7).oberon]).toEqual([true, true, false]);
    expect([at(10).morgana, at(10).mordred, at(10).oberon]).toEqual([true, true, true]);
  });

  it('builds a deck with the right sides and every enabled power', () => {
    const deck = questDeck(10, { percival: true, morgana: true, mordred: true, oberon: true });
    expect(deck.filter((r) => ['merlin', 'percival', 'servant'].includes(r))).toHaveLength(6);
    expect(deck).toEqual(expect.arrayContaining(['merlin', 'percival', 'assassin', 'morgana', 'mordred', 'oberon']));
  });

  it('warns about the Spy below 7 players and marks 11+ as experimental', () => {
    expect(questBalance({ lady: true }, 6).warnings).toContain('ladySmall');
    expect(questBalance({}, 12).warnings).toContain('experimental');
    expect(questBalance({ percival: true, morgana: true }, 8).score).toBe(2);
    expect(questBalance({ percival: true, morgana: true, mordred: true, oberon: true }, 10).score).toBe(4 - 2 + 0 - 6);
    expect(questBalance({ oberon: true }, 8).warnings).toContain('oberonStrong');
  });
});

describe('quest knowledge', () => {
  const s = setupWith(['merlin', 'percival', 'servant', 'assassin', 'morgana', 'mordred', 'oberon', 'servant', 'servant', 'servant']);

  it('shows Merlin every evil player except Mordred', () => {
    expect(knowledgeOf(s, 'p0')).toEqual({ kind: 'evil', players: ['p3', 'p4', 'p6'] });
  });
  it('shows Percival Merlin and Morgana', () => {
    expect(knowledgeOf(s, 'p1')).toEqual({ kind: 'merlinCandidates', players: ['p0', 'p4'] });
  });
  it('hides Oberon from evil and evil from Oberon', () => {
    expect(knowledgeOf(s, 'p3')).toEqual({ kind: 'team', players: ['p4', 'p5'] });
    expect(knowledgeOf(s, 'p6')).toEqual({ kind: 'none' });
  });
  it('drops ritual lines for powers that are off', () => {
    expect(ritualScript(setupWith(five))).not.toContain('percivalOpen');
    expect(ritualScript(s)).toEqual(expect.arrayContaining(['evilOpenNotOberon', 'evilThumbsNotMordred', 'merlinMorganaThumbs']));
  });
});

describe('quest flow', () => {
  it('rotates the Commander left after a rejection and after a chapter', () => {
    const s = setupWith(five, {}, 1);
    let st = initialQuestState(s);
    expect(st.commander).toBe('p1');
    st = applyQuestStep(s, st, { kind: 'propose', team: ['p1', 'p2'] });
    st = applyQuestStep(s, st, allNo(s));
    expect(st.commander).toBe('p2');
    expect(st.rejections).toBe(1);
    st = applyQuestStep(s, st, { kind: 'propose', team: ['p1', 'p2'] });
    st = applyQuestStep(s, st, allYes(s));
    st = applyQuestStep(s, st, play(['p1', 'p2']));
    expect(st.commander).toBe('p3');
    expect(st.rejections).toBe(0);
    expect(st.results[0]?.winner).toBe('good');
  });

  it('gives evil the game on the fifth rejection in a chapter', () => {
    const s = setupWith(five);
    const steps: QuestStep[] = [];
    for (let i = 0; i < 5; i++) steps.push({ kind: 'propose', team: ['p0', 'p1'] }, allNo(s));
    const end = replayQuest(s, steps).states.at(-1)!;
    expect(end).toMatchObject({ phase: 'over', winner: 'evil', reason: 'rejections' });
  });

  it('needs two Betrayals on chapter 4 at 7+ players', () => {
    const roles: QuestRole[] = ['merlin', 'servant', 'servant', 'servant', 'assassin', 'minion', 'minion'];
    const s = setupWith(roles);
    const steps: QuestStep[] = [];
    const run = (size: number, betray: string[]) => {
      const team = ids(7).slice(0, size).concat(betray.filter((b) => !ids(7).slice(0, size).includes(b))).slice(-size);
      steps.push({ kind: 'propose', team }, allYes(s), play(team, betray));
    };
    run(teamSize(7, 1), []);
    run(teamSize(7, 2), ['p4']);
    run(teamSize(7, 3), []);
    run(teamSize(7, 4), ['p4']);
    const st = replayQuest(s, steps).states.at(-1)!;
    expect(st.results.map((r) => r.winner)).toEqual(['good', 'evil', 'good', 'good']);
    expect(st.phase).toBe('guess');
  });

  it('rejects votes from anyone who is not seated', () => {
    const s = setupWith(five);
    let st = applyQuestStep(s, initialQuestState(s), { kind: 'propose', team: ['p0', 'p1'] });
    expect(questStepProblem(s, st, { kind: 'vote', votes: { ...allNo(s).votes, ghost: true, ghost2: true } })).toMatch(/seated/);
    st = applyQuestStep(s, st, allNo(s));
    expect(st.rejections).toBe(1);
  });

  it('rejects a good player playing Betrayal and a wrong team size', () => {
    const s = setupWith(five);
    let st = initialQuestState(s);
    expect(questStepProblem(s, st, { kind: 'propose', team: ['p0'] })).toMatch(/needs 2/);
    st = applyQuestStep(s, st, { kind: 'propose', team: ['p0', 'p1'] });
    st = applyQuestStep(s, st, allYes(s));
    expect(questStepProblem(s, st, play(['p0', 'p1'], ['p1']))).toMatch(/only play Success/);
  });

  it('lets evil win by guessing Merlin and lose by missing', () => {
    const s = setupWith(five);
    const good: QuestStep[] = [];
    for (const size of [2, 3, 2]) {
      const team = ids(5).slice(0, size);
      good.push({ kind: 'propose', team }, allYes(s), play(team));
    }
    expect(replayQuest(s, [...good, { kind: 'guess', target: 'p0' }]).states.at(-1)).toMatchObject({ winner: 'evil', reason: 'guessed' });
    expect(replayQuest(s, [...good, { kind: 'guess', target: 'p1' }]).states.at(-1)).toMatchObject({ winner: 'good', reason: 'missed' });
    expect(questStepProblem(s, replayQuest(s, good).states.at(-1)!, { kind: 'guess', target: 'p3' })).toMatch(/good side/);
  });

  it('runs the Spy from the right of the first Commander, after chapters 2–4, with no repeat inspections', () => {
    const roles: QuestRole[] = ['merlin', 'servant', 'servant', 'servant', 'assassin', 'minion', 'minion'];
    const s = setupWith(roles, { lady: true }, 2);
    let st = initialQuestState(s);
    expect(st.spy).toBe('p1');
    const chapter = (betray: string[] = []) => {
      const team = ids(7).slice(7 - teamSize(7, st.chapter));
      st = applyQuestStep(s, st, { kind: 'propose', team });
      st = applyQuestStep(s, st, allYes(s));
      st = applyQuestStep(s, st, play(team, betray));
    };
    chapter();
    expect(st.phase).toBe('propose');
    chapter(['p4']);
    expect(st.phase).toBe('spy');
    expect(questStepProblem(s, st, { kind: 'spy', target: 'p1' })).toMatch(/themselves/);
    st = applyQuestStep(s, st, { kind: 'spy', target: 'p4' });
    expect(st.spyChecks[0]).toMatchObject({ spy: 'p1', target: 'p4', side: 'evil' });
    chapter();
    expect(st.phase).toBe('spy');
    expect(st.spy).toBe('p4');
    expect(questStepProblem(s, st, { kind: 'spy', target: 'p1' })).toMatch(/already been/);
  });

  it('flags later steps that become illegal after an earlier edit', () => {
    const s = setupWith(five);
    const steps: QuestStep[] = [{ kind: 'propose', team: ['p0', 'p1'] }, allYes(s), play(['p0', 'p1'])];
    steps[0] = { kind: 'propose', team: ['p3', 'p4'] };
    const r = replayQuest(s, steps);
    expect(r.invalidFrom).toBe(2);
  });
});

describe('quest dealing', () => {
  it('deals named Polashi cards, using the 11–15 extras only once the original ten run out', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const players = ids(15).map((id) => ({ id, name: id }));
    const setup = dealQuest(players, { percival: true }, random, cardFaces('polashi'));
    const faces = Object.values(setup.cards);
    expect(new Set(faces).size).toBe(15);
    expect(faces).toEqual(expect.arrayContaining(['mirMadan', 'mohonLal', 'mirJafar', 'siraj', 'lutfunnesa', 'deBusi', 'saintFrey', 'ghoseti', 'rayDurlov', 'umichad']));
    const small = dealQuest(ids(10).map((id) => ({ id, name: id })), {}, random, cardFaces('polashi'));
    expect(Object.values(small.cards)).not.toEqual(expect.arrayContaining(['robertClive']));
    expect(Object.values(small.cards)).toContain('mohonLal');
  });
});
