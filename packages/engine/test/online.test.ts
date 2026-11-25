import { describe, expect, it } from 'vitest';
import {
  apply,
  createRoom,
  gameState,
  join,
  setConnected,
  tick,
  viewFor,
  HOST_GRACE_MS,
  type Command,
  type Env,
  type Member,
  type Room,
  type RoleId,
} from '../src';

let ids = 0;
const env = (now = 0, random = () => 0.42): Env => ({ now, random, id: () => `id${++ids}` });

function lobby(names: string[]) {
  const room = createRoom('ABCD', 0);
  const members = names.map((n) => join(room, n, env()) as Member);
  return { room, members };
}

/** Starts a game and then overwrites the dealt roles so tests are deterministic. */
function started(roles: Record<string, RoleId>, settings: Partial<Room['settings']> = {}) {
  const { room, members } = lobby(Object.keys(roles));
  const counts: Partial<Record<RoleId, number>> = {};
  for (const r of Object.values(roles)) counts[r] = (counts[r] ?? 0) + 1;
  const host = members[0]!.id;
  expect(apply(room, host, { type: 'configure', settings: { ...settings, counts } }, env())).toBeNull();
  expect(apply(room, host, { type: 'start' }, env())).toBeNull();
  for (const m of members) room.setup!.roles[m.id] = roles[m.name]!;
  const id = (name: string) => members.find((m) => m.name === name)!.id;
  const run = (name: string, cmd: Command, now = 0) => apply(room, id(name), cmd, env(now));
  for (const m of members) run(m.name, { type: 'seenRole' });
  return { room, members, id, run };
}

const roles = {
  ali: 'mafia',
  bo: 'godfather',
  cy: 'doctor',
  di: 'detective',
  ed: 'villager',
  fa: 'villager',
  gu: 'villager',
} as const;

function answerAll(room: Room, run: (n: string, c: Command) => string | null, choose: (name: string, card: number) => string | null) {
  for (const m of room.members) {
    const cards = room.night?.cards[m.id] ?? [];
    cards.forEach((_, i) => run(m.name, { type: 'pick', card: i, target: choose(m.name, i) }));
  }
}

describe('online room: quick tap night', () => {
  it('gives every living player exactly two picks with identical shapes', () => {
    const { room } = started(roles);
    expect(room.phase).toBe('night');
    for (const m of room.members) expect(room.night!.cards[m.id]).toHaveLength(2);
    const kinds = room.members.map((m) => room.night!.cards[m.id]!.map((c) => c.kind));
    expect(kinds.every((k) => k[1] === 'predictRole')).toBe(true);
  });

  it("uses the Godfather's pick, resolves the night and moves to the day", () => {
    const { room, id, run } = started(roles);
    answerAll(room, run, (name, card) => {
      if (card === 1) return id('ed');
      if (name === 'ali') return id('fa');
      if (name === 'bo') return id('gu');
      if (name === 'cy') return id('cy');
      return id('ali');
    });
    expect(room.night!.stage).toBe('pause');
    tick(room, env(10_000));
    expect(room.phase).toBe('day');
    const state = gameState(room)!;
    expect(state.alive[id('gu')]).toBe(false);
    expect(state.alive[id('fa')]).toBe(true);
    expect(room.announcement?.entries[0]).toMatchObject({ name: 'gu', role: 'villager' });
  });

  it('falls back to a Mafia majority, with ties broken at random, when there is no Godfather', () => {
    const { room, id, run } = started({ ...roles, bo: 'mafia' }, { counts: {} });
    answerAll(room, run, (name, card) => {
      if (card === 1) return null;
      if (name === 'ali') return id('fa');
      if (name === 'bo') return id('gu');
      return null;
    });
    tick(room, env(10_000));
    const dead = room.members.filter((m) => !gameState(room)!.alive[m.id]).map((m) => m.name);
    expect(dead).toHaveLength(1);
    expect(['fa', 'gu']).toContain(dead[0]);
  });

  it('never leaks other roles in a villager or TV view, and shows Mafia their team', () => {
    const { room, id } = started(roles);
    const villager = viewFor(room, id('ed'));
    expect(villager.you?.role).toBe('villager');
    expect(villager.you?.teammates).toEqual([]);
    expect(villager.players.every((p) => p.shownRole === undefined)).toBe(true);
    expect(villager.night?.mafiaVotes).toEqual([]);

    const tv = viewFor(room, 'tv');
    expect(tv.you).toBeNull();
    expect(tv.night?.cards).toEqual([]);
    expect(tv.players.every((p) => p.shownRole === undefined)).toBe(true);

    const mafia = viewFor(room, id('ali'));
    expect(mafia.you?.teammates.map((t) => t.name)).toEqual(['bo']);
  });
});

describe('online room: day vote', () => {
  function toDay() {
    const s = started(roles, { discussionSeconds: 30 });
    answerAll(s.room, s.run, () => null);
    tick(s.room, env(10_000));
    tick(s.room, env(60_000));
    expect(s.room.day?.stage).toBe('vote');
    return s;
  }

  it('eliminates a player with a strict majority', () => {
    const { room, id, run } = toDay();
    for (const n of ['ali', 'bo', 'cy', 'di']) run(n, { type: 'vote', target: id('ed') });
    for (const n of ['ed', 'fa', 'gu']) run(n, { type: 'vote', target: 'skip' });
    expect(room.day?.stage).toBe('result');
    expect(gameState(room)!.alive[id('ed')]).toBe(false);
  });

  it('runs a runoff without a majority and kills both on a second tie', () => {
    const { room, id, run } = toDay();
    run('ali', { type: 'vote', target: id('cy') });
    run('bo', { type: 'vote', target: id('cy') });
    run('cy', { type: 'vote', target: id('di') });
    run('di', { type: 'vote', target: id('di') });
    for (const n of ['ed', 'fa', 'gu']) run(n, { type: 'vote', target: 'skip' });
    expect(room.day?.stage).toBe('runoff');
    expect(room.day?.candidates.sort()).toEqual([id('cy'), id('di')].sort());

    run('ali', { type: 'vote', target: id('cy') });
    run('bo', { type: 'vote', target: id('cy') });
    run('cy', { type: 'vote', target: id('di') });
    run('di', { type: 'vote', target: id('di') });
    for (const n of ['ed', 'fa', 'gu']) run(n, { type: 'vote', target: 'skip' });
    const state = gameState(room)!;
    expect(state.alive[id('cy')]).toBe(false);
    expect(state.alive[id('di')]).toBe(false);
  });
});

describe('online room: narrated night', () => {
  it('calls roles in order and waits for the sleep timer between them', () => {
    const { room, id, run } = started(roles, { nightStyle: 'narrated', sleepSeconds: 3 });
    expect(room.night?.stage).toBe('ready');
    for (const m of room.members) run(m.name, { type: 'ready' });
    expect(room.night?.stage).toBe('awake');
    expect(room.night?.queue.map((q) => q.key)).toEqual(['mafia', 'doctor', 'detective']);

    expect(viewFor(room, id('ed')).night?.awake).toBe(false);
    expect(viewFor(room, id('ali')).night?.awake).toBe(true);
    run('bo', { type: 'pick', card: 0, target: id('gu') });
    run('ali', { type: 'pick', card: 0, target: id('gu') });
    expect(viewFor(room, id('ali')).night?.mafiaVotes).toHaveLength(2);
    run('ali', { type: 'done' });
    expect(room.night?.stage).toBe('awake');
    run('bo', { type: 'done' });
    expect(room.night?.stage).toBe('sleep');
    tick(room, env(3_000));
    expect(room.night?.queue[room.night.current]?.key).toBe('doctor');
    run('cy', { type: 'pick', card: 0, target: id('gu') });
    run('cy', { type: 'done' });
    tick(room, env(6_000));
    run('di', { type: 'pick', card: 0, target: id('ali') });
    expect(viewFor(room, id('di')).night?.cards[0]?.result).toBe('mafia');
    run('di', { type: 'done' });
    tick(room, env(9_000));
    expect(room.phase).toBe('day');
    expect(gameState(room)!.alive[id('gu')]).toBe(true);
  });
});

describe('online room: hosts and absent players', () => {
  it('hands host powers to the next connected player after the grace period', () => {
    const { room, members } = lobby(['ali', 'bo', 'cy', 'di', 'ed']);
    setConnected(room, members[0]!.id, false, 0);
    tick(room, env(HOST_GRACE_MS - 1));
    expect(room.hostId).toBe(members[0]!.id);
    tick(room, env(HOST_GRACE_MS));
    expect(room.hostId).toBe(members[1]!.id);
  });

  it('lets a leaving host pick a successor', () => {
    const { room, members } = lobby(['ali', 'bo', 'cy', 'di', 'ed']);
    apply(room, members[0]!.id, { type: 'leave', successor: members[3]!.id }, env());
    expect(room.hostId).toBe(members[3]!.id);
  });

  it('asks the host to confirm a removal that would end the game', () => {
    const { room, id, run } = started({ ali: 'mafia', bo: 'villager', cy: 'villager', di: 'villager', ed: 'villager' });
    run('ali', { type: 'admin', action: { kind: 'remove', player: id('ali') } });
    expect(room.confirmRemove).toMatchObject({ player: id('ali'), winner: 'village' });
    expect(room.phase).toBe('night');
    run('ali', { type: 'admin', action: { kind: 'remove', player: id('ali'), confirm: true } });
    expect(room.phase).toBe('over');
    expect(room.winner).toBe('village');
  });

  it("doesn't wait for absent players", () => {
    const { room, id, run } = started(roles);
    run('gu', { type: 'leave' });
    answerAll(room, run, () => null);
    expect(room.night?.stage).toBe('pause');
    expect(room.night?.cards[id('gu')]?.some((c) => c.target === undefined)).toBe(true);
  });
});
