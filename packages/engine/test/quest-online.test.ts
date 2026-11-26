import { describe, expect, it } from 'vitest';
import { quest, type Env, type Member } from '../src';

const { applyQuest, createQuestRoom, joinQuest, questNextAlarm, questRoomState, setQuestConnected, tickQuest, viewQuest, knowledgeOf, sideOf } = quest;
type QuestRoom = quest.QuestRoom;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function room(players: number, settings: Partial<QuestRoom['settings']> = {}, seed = 1) {
  const random = rng(seed);
  let n = 0;
  let now = 0;
  const env = (): Env => ({ now, random, id: () => `id${seed}-${++n}` });
  const r = createQuestRoom('QEST', 0);
  const members = Array.from({ length: players }, (_, i) => joinQuest(r, `P${i}`, env()) as Member);
  const host = () => r.hostId!;
  expect(applyQuest(r, host(), { type: 'configure', settings }, env())).toBeNull();
  expect(applyQuest(r, host(), { type: 'start' }, env())).toBeNull();
  return { r, members, env, random, advance: (ms: number) => (now += ms) };
}

describe('quest room', () => {
  it('plays a full game through phones: reveal, propose, secret votes, cards, guess', () => {
    const { r, members, env } = room(5);
    for (const m of members) applyQuest(r, m.id, { type: 'seenRole' }, env());
    expect(r.phase).toBe('game');

    const roleOf = (id: string) => r.setup!.roles[id]!;
    const good = members.filter((m) => sideOf(roleOf(m.id)) === 'good');
    for (let guard = 0; guard < 30 && r.phase === 'game'; guard++) {
      const s = questRoomState(r)!;
      if (s.phase === 'propose') {
        const size = viewQuest(r, s.commander).board!.teams[s.chapter - 1]!;
        expect(applyQuest(r, s.commander, { type: 'propose', team: good.slice(0, size).map((m) => m.id).concat(members.map((m) => m.id)).filter((v, i, a) => a.indexOf(v) === i).slice(0, size) }, env())).toBeNull();
      } else if (s.phase === 'vote') {
        for (const m of members) applyQuest(r, m.id, { type: 'vote', approve: true }, env());
      } else if (s.phase === 'chapter') {
        for (const id of s.team!) applyQuest(r, id, { type: 'play', card: 'success' }, env());
      } else if (s.phase === 'guess') {
        const assassin = members.find((m) => roleOf(m.id) === 'assassin')!;
        expect(viewQuest(r, assassin.id).you?.canGuess).toBe(true);
        const notMerlin = good.find((m) => roleOf(m.id) !== 'merlin')!;
        expect(applyQuest(r, assassin.id, { type: 'guess', target: notMerlin.id }, env())).toBeNull();
      }
    }
    expect(r.phase).toBe('over');
    expect(viewQuest(r, 'tv').outcome).toMatchObject({ winner: 'good', reason: 'missed' });
  });

  it('keeps votes and cards secret until everyone is in, and refuses a good Betrayal', () => {
    const { r, members, env } = room(5);
    for (const m of members) applyQuest(r, m.id, { type: 'seenRole' }, env());
    const s = questRoomState(r)!;
    const team = members.slice(0, 2).map((m) => m.id);
    applyQuest(r, s.commander, { type: 'propose', team }, env());
    applyQuest(r, members[0]!.id, { type: 'vote', approve: false }, env());
    const peek = viewQuest(r, members[1]!.id);
    expect(peek.board?.votesIn).toBe(1);
    expect(peek.board?.lastVote).toBeNull();
    for (const m of members.slice(1)) applyQuest(r, m.id, { type: 'vote', approve: true }, env());
    expect(r.announcement).toMatchObject({ kind: 'vote', approved: true, yes: 4, no: 1 });
    const goodOnTeam = team.find((id) => sideOf(r.setup!.roles[id]!) === 'good');
    if (goodOnTeam) expect(applyQuest(r, goodOnTeam, { type: 'play', card: 'betray' }, env())).toMatch(/only play Success/);
  });

  it('shows each player only what their character knows', () => {
    const { r, members } = room(10, { rules: { percival: true, morgana: true, mordred: true, oberon: true } });
    for (const m of members) {
      const v = viewQuest(r, m.id);
      const k = knowledgeOf(r.setup!, m.id);
      expect(v.you?.knows.kind).toBe(k.kind);
      expect(v.you?.knows.players.map((p) => p.name).sort()).toEqual((k.kind === 'none' ? [] : k.players.map((id) => r.members.find((x) => x.id === id)!.name)).sort());
      expect(v.players.every((p) => p.role === undefined)).toBe(true);
    }
    expect(viewQuest(r, 'tv').you).toBeNull();
  });

  it("doesn't wait for absent players and lets the host skip a stuck Commander", () => {
    const { r, members, env, advance } = room(6);
    for (const m of members) applyQuest(r, m.id, { type: 'seenRole' }, env());
    const s = questRoomState(r)!;
    const away = members.find((m) => m.id !== s.commander && m.id !== r.hostId)!;
    setQuestConnected(r, away.id, false, env().now);
    advance(50_000);
    tickQuest(r, env());
    expect(away.absent).toBe(true);
    applyQuest(r, r.hostId!, { type: 'admin', action: { kind: 'skip' } }, env());
    expect(questRoomState(r)!.phase).toBe('vote');
    for (const m of members) if (m.id !== away.id) applyQuest(r, m.id, { type: 'vote', approve: false }, env());
    expect(questRoomState(r)!.votes).toHaveLength(1);
    expect(questRoomState(r)!.votes[0]!.votes[away.id]).toBe(true);
  });

  it('lets the host undo the last public step only', () => {
    const { r, members, env } = room(5);
    for (const m of members) applyQuest(r, m.id, { type: 'seenRole' }, env());
    const s = questRoomState(r)!;
    applyQuest(r, s.commander, { type: 'propose', team: members.slice(0, 2).map((m) => m.id) }, env());
    expect(applyQuest(r, r.hostId!, { type: 'admin', action: { kind: 'undo' } }, env())).toBeNull();
    expect(questRoomState(r)!.phase).toBe('propose');
  });
});

describe('fuzz: quest rooms', () => {
  const GAMES = Number(process.env.FUZZ_GAMES ?? 40);
  const RULES: quest.QuestRuleChoices[] = [{}, { percival: true, morgana: true }, { percival: true, morgana: true, mordred: true, oberon: true, lady: true }, { lady: true, anonymousVotes: true }];

  function play(seed: number) {
    const random = rng(seed);
    const players = 5 + Math.floor(random() * 11);
    const { r, members, env, advance } = room(players, { rules: RULES[seed % RULES.length], skin: seed % 2 ? 'polashi' : 'avalon' }, seed);
    const pick = <T,>(a: T[]) => a[Math.floor(random() * a.length)]!;
    let loops = 0;
    while (r.phase !== 'over' && loops++ < 3000) {
      advance(Math.floor(random() * 3000));
      tickQuest(r, env());
      const roll = random();
      const someone = pick(members);
      if (roll < 0.02) setQuestConnected(r, someone.id, false, env().now);
      else if (roll < 0.06) setQuestConnected(r, someone.id, true, env().now);
      else if (roll < 0.065) applyQuest(r, r.hostId!, { type: 'admin', action: { kind: 'undo' } }, env());
      else if (roll < 0.075) applyQuest(r, r.hostId!, { type: 'admin', action: { kind: 'skip' } }, env());
      if (!r.hostId) r.hostId = members[0]!.id;

      for (const m of members) {
        if (m.absent || !m.connected) continue;
        const v = viewQuest(r, m.id);
        expect(v.players.every((p) => (r.phase === 'over') === (p.role !== undefined))).toBe(true);
        if (v.you?.side === 'good') expect(v.you.knows.players.every((p) => p.role === undefined)).toBe(true);
        if (r.phase === 'reveal' && !v.you?.seenRole) applyQuest(r, m.id, { type: 'seenRole' }, env());
        const s = questRoomState(r);
        if (r.phase !== 'game' || !s) continue;
        if (s.phase === 'propose' && s.commander === m.id) {
          const size = v.board!.teams[s.chapter - 1]!;
          const team = [...members].sort(() => random() - 0.5).slice(0, size).map((x) => x.id);
          expect(applyQuest(r, m.id, { type: 'propose', team }, env())).toBeNull();
        } else if (s.phase === 'vote' && v.you?.myVote === undefined) {
          applyQuest(r, m.id, { type: 'vote', approve: random() < 0.6 }, env());
        } else if (s.phase === 'chapter' && s.team?.includes(m.id) && !v.you?.myPlay) {
          const card = v.you?.side === 'evil' && random() < 0.6 ? 'betray' : 'success';
          expect(applyQuest(r, m.id, { type: 'play', card }, env())).toBeNull();
        } else if (s.phase === 'spy' && s.spy === m.id) {
          const options = members.filter((x) => !s.pastSpies.includes(x.id));
          expect(applyQuest(r, m.id, { type: 'spy', target: pick(options).id }, env())).toBeNull();
        } else if (s.phase === 'guess' && v.you?.canGuess) {
          const good = members.filter((x) => sideOf(r.setup!.roles[x.id]!) === 'good');
          expect(applyQuest(r, m.id, { type: 'guess', target: pick(good).id }, env())).toBeNull();
        }
      }
      if (r.phase === 'game' && random() < 0.02) applyQuest(r, r.hostId!, { type: 'admin', action: { kind: 'skip' } }, env());
    }
    if (r.phase !== 'over') throw new Error(`seed ${seed} stuck: ${JSON.stringify(questRoomState(r)?.phase)}`);
    return questRoomState(r)!.reason;
  }

  it(`plays ${GAMES} random quest games to the end`, () => {
    const reasons = Array.from({ length: GAMES }, (_, i) => play(i + 1));
    expect(new Set(reasons).size).toBeGreaterThan(2);
  }, 300_000);
});

describe('quest room timers', () => {
  it('does not keep an overdue host-handover alarm when everyone has left', () => {
    const { r, members, env, advance } = room(5);
    for (const m of members) setQuestConnected(r, m.id, false, 0);
    advance(10 * 60_000);
    tickQuest(r, env());
    // Nobody can take over, so there is nothing to wake up for; an overdue alarm here used to fire in a loop.
    const due = questNextAlarm(r);
    expect(due === null || due > 10 * 60_000).toBe(true);

    const host = r.hostId;
    setQuestConnected(r, members[3]!.id, true, 10 * 60_000);
    tickQuest(r, env());
    expect(r.hostId).not.toBe(host);
    expect(r.hostId).toBe(members[3]!.id);
  });
});
