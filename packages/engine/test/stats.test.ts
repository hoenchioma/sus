import { describe, expect, it } from 'vitest';
import {
  apply,
  createRoom,
  endGame,
  goTo,
  join,
  mafiaRoomRecord,
  newGame,
  setStep,
  tick,
  trackerRecord,
  type Command,
  type Env,
  type Member,
  type RoleId,
} from '../src';
import { expectAnonymous, makeSetup } from './helpers';

let ids = 0;
const env = (now = 0): Env => ({ now, random: () => 0.42, id: () => `id${++ids}` });

const roles: Record<string, RoleId> = {
  'Ali Khan': 'mafia',
  Bo: 'godfather',
  Cy: 'doctor',
  Di: 'detective',
  Ed: 'villager',
  Fa: 'villager',
  Gu: 'villager',
};

function phoneGame() {
  const room = createRoom('ABCD', 0);
  const members = Object.keys(roles).map((n) => join(room, n, env()) as Member);
  members.forEach((m, i) => (m.device = `device-${i}`));
  const id = (name: string) => members.find((m) => m.name === name)!.id;
  const run = (name: string, cmd: Command, now = 0) => apply(room, id(name), cmd, env(now));
  const counts: Partial<Record<RoleId, number>> = { mafia: 1, godfather: 1, doctor: 1, detective: 1, villager: 3 };
  run('Ali Khan', { type: 'configure', settings: { counts, discussionSeconds: 30 } });
  run('Ali Khan', { type: 'start' }, 5_000);
  for (const m of members) room.setup!.roles[m.id] = roles[m.name]!;
  for (const m of members) run(m.name, { type: 'seenRole' });

  /** A night where nobody acts (everyone guesses Ed), then a day where everyone votes out `out`. */
  const round = (out: string, now: number) => {
    for (const m of room.members) {
      (room.night?.cards[m.id] ?? []).forEach((card, i) => run(m.name, { type: 'pick', card: i, target: card.kind === 'action' ? null : id('Ed') }));
    }
    tick(room, env(now + 10_000));
    tick(room, env(now + 60_000));
    for (const m of room.members) if (room.day?.votes && room.setup && !room.day.votes[m.id]) run(m.name, { type: 'vote', target: id(out) });
    tick(room, env(now + 80_000));
  };
  return { room, members, id, run, round };
}

describe('stats records', () => {
  it('records a phone game by seat, with every ballot, and no names', () => {
    const { room, members, round } = phoneGame();
    round('Ali Khan', 0);
    expect(room.phase).toBe('night');
    round('Bo', 100_000);
    expect(room.phase).toBe('over');

    const record = mafiaRoomRecord(room, { endedAt: 200_000 })!;
    expectAnonymous(record, members);
    expect(record).toMatchObject({ family: 'mafia', source: 'phones', winner: 'village', endReason: 'win', rounds: 2, players: 7, startedAt: 5_000, test: false });
    expect(record.id).toBe(room.gameId);

    const [ali, bo, cy] = record.seats;
    expect(ali).toMatchObject({ seat: 0, role: 'mafia', team: 'mafia', won: false, survived: false, diedRound: 1, diedPhase: 'day', diedCause: 'vote', host: true, device: 'device-0' });
    expect(bo).toMatchObject({ role: 'godfather', won: false, diedRound: 2, diedPhase: 'day' });
    expect(cy).toMatchObject({ role: 'doctor', won: true, survived: true });
    // Cy voted against both Mafia; Ali voted himself out; both Mafia drew every vote.
    expect(cy!.stats).toMatchObject({ votes: 2, votesOn_mafia: 2 });
    expect(ali!.stats).toMatchObject({ votesOnSelf: 1, votesReceived: 7 });
    expect(bo!.stats.votesReceived).toBe(6);
    expect((record.timeline as { ballots: unknown[] }).ballots).toHaveLength(13);
    // Night 1 guesses: Ed didn't die, so none of the "who dies tonight" guesses were right.
    expect(record.seats.every((s) => !s.stats.deathGuessesRight)).toBe(true);
  });

  it('marks test phones and host-ended games', () => {
    const { room, members, run } = phoneGame();
    members[3]!.test = true;
    run('Ali Khan', { type: 'admin', action: { kind: 'end' } });
    const record = mafiaRoomRecord(room, { endedAt: 1 })!;
    expect(record).toMatchObject({ test: true, winner: 'none', endReason: 'host' });
    expect(record.seats.some((s) => s.won)).toBe(false);
  });

  it('starts a new game id for a rematch', () => {
    const { room, run } = phoneGame();
    const first = room.gameId;
    run('Ali Khan', { type: 'admin', action: { kind: 'end' } });
    run('Ali Khan', { type: 'admin', action: { kind: 'rematch' } });
    expect(mafiaRoomRecord(room, { endedAt: 1 })).toBeNull();
    run('Ali Khan', { type: 'start' });
    expect(room.gameId).not.toBe(first);
    expect(room.ballots).toEqual([]);
  });
});

describe('one-phone uploads', () => {
  const setup = makeSetup({ a: 'mafia', b: 'doctor', c: 'villager', d: 'villager', e: 'villager' });
  const finished = () => {
    let game = newGame(setup);
    game = setStep(game, 0, { kind: 'night', actions: { mafia: 'c', doctor: 'b' } });
    game = goTo(game, 1);
    game = setStep(game, 1, { kind: 'day', eliminated: ['a'] });
    return endGame(game, 'village');
  };
  const upload = (game: unknown, extra = {}) => ({ family: 'mafia', id: 'tracker-game-1', skin: 'werewolf', game, ...extra });

  it('accepts a finished game and records it without names', () => {
    const record = trackerRecord(upload(finished(), { test: true, startedAt: 10 }), 100);
    if (typeof record === 'string') throw new Error(record);
    expectAnonymous(record, setup.players);
    expect(record).toMatchObject({ source: 'tracker', skin: 'werewolf', winner: 'village', test: true, startedAt: 10, endedAt: 100, rounds: 1 });
    expect(record.seats.map((s) => s.won)).toEqual([false, true, true, true, true]);
    expect(record.seats[2]).toMatchObject({ survived: false, diedPhase: 'night', diedCause: 'mafia' });
  });

  it('refuses games that are not over, made-up winners and junk', () => {
    const game = finished();
    expect(trackerRecord(upload({ ...game, ended: undefined }), 1)).toBe('The game is not over');
    expect(trackerRecord(upload({ ...game, ended: 'mafia' }), 1)).toBe('The game is not over');
    expect(trackerRecord(upload({ ...game, setup: { ...setup, roles: { ...setup.roles, a: 'wizard' } } }), 1)).toBe('Bad roles');
    expect(trackerRecord(upload(game, { id: 'x' }), 1)).toBe('Bad id');
    expect(trackerRecord(upload({ ...game, steps: 'nope' }), 1)).toBe('Bad game');
    expect(trackerRecord(null, 1)).toBe('Bad upload');
    expect(trackerRecord({ family: 'quest', id: 'tracker-game-1', skin: 'polashi', setup: { players: [] }, steps: [] }, 1)).toBe('Bad setup');
  });
});
