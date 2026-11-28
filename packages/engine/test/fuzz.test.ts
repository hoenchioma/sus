import { describe, expect, it } from 'vitest';
import {
  ROLE_IDS,
  ROLES,
  apply,
  createRoom,
  gameState,
  goTo,
  join,
  mafiaRoomRecord,
  newGame,
  nightPrompts,
  phaseOf,
  replay,
  rulesOf,
  nextAlarm,
  setConnected,
  setStep,
  setupProblems,
  suggestedRoles,
  teamOf,
  tick,
  viewFor,
  winnerOf,
  type Command,
  type Env,
  type Member,
  type RoleCounts,
  type RoleId,
  type Room,
  type RuleChoices,
  type Step,
} from '../src';
import { expectAnonymous } from './helpers';

const GAMES = Number(process.env.FUZZ_GAMES ?? 40);

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(items: T[], r: () => number): T => items[Math.floor(r() * items.length)]!;

const RULE_VARIANTS: RuleChoices[] = [
  {},
  { deathReveal: 'team' },
  { deathReveal: 'none', deadCanTalk: true, ghostVote: true },
  { protectorsAlternate: false, doctorSelf: 'never', loverSelf: true, loverDayDeath: true },
  { noKillNight1: true, skProtectable: false, godfatherInnocent: true },
  { votesNeeded: 'plurality', tieBreak: 'random', jesterEnds: false },
  { votesNeeded: 'half', tieBreak: 'nobody' },
  { tieBreak: 'host' },
];

/** A random but valid role mix: the suggested mix with some specials swapped in. */
function randomRoles(players: number, r: () => number): RoleCounts {
  for (let attempt = 0; attempt < 50; attempt++) {
    const counts: RoleCounts = { ...suggestedRoles(players) };
    for (let swaps = Math.floor(r() * 4); swaps > 0; swaps--) {
      const to = pick(ROLE_IDS, r);
      if ((counts.villager ?? 0) < 1 || (ROLES[to].unique && counts[to])) continue;
      counts.villager! -= 1;
      counts[to] = (counts[to] ?? 0) + 1;
    }
    if (!setupProblems(counts).length) return counts;
  }
  return suggestedRoles(players);
}

function checkViews(room: Room) {
  const state = gameState(room);
  const setup = room.setup;
  if (!setup || !state) return;
  const rules = rulesOf(setup);
  for (const m of room.members) {
    const v = viewFor(room, m.id);
    const myRole = setup.roles[m.id]!;
    expect(v.you?.role).toBe(myRole);
    for (const p of v.players) {
      if (room.phase === 'over') continue;
      if (p.shownRole) {
        expect(state.alive[p.id]).toBe(false);
        expect(rules.deathReveal).toBe('full');
      }
    }
    if (teamOf(myRole) !== 'mafia') {
      expect(v.you?.teammates).toEqual([]);
      expect(v.night?.mafiaVotes ?? []).toEqual([]);
      expect(v.night?.chat ?? []).toEqual([]);
    }
  }
  const tv = viewFor(room, 'tv');
  expect(tv.you).toBeNull();
  expect(tv.night?.cards ?? []).toEqual([]);
  expect(tv.host).toBeNull();
}

/** A timer still due after a tick would make the server's alarm fire again straight away, forever. */
function expectNoOverdueAlarm(due: number | null, now: number) {
  if (due !== null && due <= now) throw new Error(`alarm overdue after tick: due ${due}, now ${now}`);
}

function playOnline(seed: number) {
  const r = rng(seed);
  let now = 1_000;
  let n = 0;
  const env = (): Env => ({ now, random: r, id: () => `p${seed}-${++n}` });
  const players = 5 + Math.floor(r() * 11);
  const room = createRoom('FUZZ', now);
  Array.from({ length: players }, (_, i) => join(room, `P${i}`, env()) as Member);
  const style = r() < 0.5 ? 'quick' : 'narrated';
  const rules = pick(RULE_VARIANTS, r);
  const counts = randomRoles(players, r);
  const host = () => room.hostId!;
  const unexpected: string[] = [];
  const run = (id: string, cmd: Command) => {
    const error = apply(room, id, cmd, env());
    if (error && !['Not now', 'Voting is closed', 'Make your choice first'].includes(error)) {
      unexpected.push(`${cmd.type}: ${error}`);
    }
  };

  run(host(), { type: 'configure', settings: { counts, rules, nightStyle: style, sleepSeconds: 3, discussionSeconds: 30 } });
  run(host(), { type: 'start' });
  expect(room.phase).toBe('reveal');

  const disconnected = new Set<string>();
  let loops = 0;
  let lastDeaths = 0;
  while (room.phase !== 'over' && loops++ < 4000) {
    now += Math.floor(r() * 2500);
    tick(room, env());
    expectNoOverdueAlarm(nextAlarm(room), now);

    // Chaos: drops, reconnects, the host leaving, removals and Mayor reveals.
    const roll = r();
    const someone = pick(room.members, r);
    if (roll < 0.03 && !someone.absent) {
      setConnected(room, someone.id, false, now);
      disconnected.add(someone.id);
    } else if (roll < 0.08 && disconnected.size) {
      const back = pick([...disconnected], r);
      setConnected(room, back, true, now);
      disconnected.delete(back);
    } else if (roll < 0.085 && room.members.filter((m) => !m.absent).length > 3) {
      const successor = pick(room.members.filter((m) => !m.absent && m.id !== host()), r);
      run(host(), { type: 'leave', successor: successor?.id });
    } else if (roll < 0.1 && room.hostId) {
      const absent = room.members.find((m) => m.absent && gameState(room)?.alive[m.id]);
      if (absent) run(host(), { type: 'admin', action: { kind: 'remove', player: absent.id, confirm: r() < 0.5 } });
      if (room.confirmRemove && r() < 0.5) run(host(), { type: 'admin', action: { kind: 'cancelRemove' } });
    }
    if (!room.hostId) {
      // Everyone the host could hand over to is gone; someone reconnecting picks it back up after the grace period.
      const back = room.members.find((m) => !m.absent) ?? room.members[0]!;
      setConnected(room, back.id, true, now);
      room.hostId = back.id;
    }
    if ((room.phase as string) === 'over') break;

    const state = gameState(room);
    for (const m of room.members) {
      if (!m.connected || m.absent) continue;
      const view = viewFor(room, m.id);
      if (room.phase === 'reveal' && !view.you?.seenRole) run(m.id, { type: 'seenRole' });
      if (room.phase === 'night' && view.night) {
        if (view.night.needReady) run(m.id, { type: 'ready' });
        for (const card of view.night.cards) {
          if (card.target !== undefined) continue;
          const options = card.options.filter((o) => !o.disabled);
          run(m.id, { type: 'pick', card: card.index, target: options.length && r() < 0.85 ? pick(options, r).id : null });
        }
        if (style === 'narrated' && view.night.awake && view.night.cards.every((c) => c.target !== undefined) && !view.night.youDone) {
          run(m.id, { type: 'done' });
        }
      }
      if (room.phase === 'day' && view.day && state) {
        if (view.you?.isMayor && r() < 0.1) run(m.id, { type: 'revealMayor' });
        if ((view.day.stage === 'vote' || view.day.stage === 'runoff') && view.you && !view.you.myVote && (view.you.canVote || view.you.ghostVote)) {
          const living = view.players.filter((p) => p.alive && (view.day!.stage === 'vote' || view.day!.candidates.includes(p.id)));
          const target = view.you.canVote && r() < 0.2 ? 'skip' : pick(living, r).id;
          run(m.id, { type: 'vote', target });
        }
      }
    }
    if (room.phase === 'day' && room.day && r() < 0.5) {
      if (room.day.stage === 'discussion' || room.day.stage === 'result') run(host(), { type: 'admin', action: { kind: 'continue' } });
      else if (room.day.stage === 'hostPick') run(host(), { type: 'admin', action: { kind: 'hostPick', player: pick(room.day.candidates, r) } });
    }
    if (r() < 0.01) run(host(), { type: 'admin', action: { kind: 'skip' } });

    checkViews(room);
    if (room.phase === 'night' && style === 'quick' && room.night && state) {
      const shapes = Object.values(room.night.cards).map((c) => c.length);
      expect(new Set(shapes).size).toBeLessThanOrEqual(1);
    }
    const deaths = gameState(room)?.deaths.length ?? 0;
    expect(deaths).toBeGreaterThanOrEqual(lastDeaths);
    lastDeaths = deaths;
  }

  // The end of every real game: all phones close and nobody comes back for a long time.
  for (const m of room.members) setConnected(room, m.id, false, now);
  for (const later of [60_000, 10 * 60_000, 24 * 3600_000]) {
    tick(room, { ...env(), now: now + later });
    expectNoOverdueAlarm(nextAlarm(room), now + later);
  }

  if (room.phase !== 'over') {
    throw new Error(`seed ${seed} stuck in ${room.phase} ${JSON.stringify({ night: room.night?.stage, day: room.day?.stage, deadline: room.deadline })}`);
  }
  const final = gameState(room)!;
  if (!room.endedByHost) expect(winnerOf(room.setup!, final, rulesOf(room.setup!))).toBe(room.winner);
  expect(unexpected).toEqual([]);
  const record = mafiaRoomRecord(room, { endedAt: now })!;
  expectAnonymous(record, room.members);
  expect(record.seats.filter((s) => s.survived).length).toBe(room.setup!.players.filter((p) => final.alive[p.id]).length);
  return { players, style, winner: room.winner, loops };
}

function playTracker(seed: number) {
  const r = rng(seed);
  const players = 5 + Math.floor(r() * 11);
  const ids = Array.from({ length: players }, (_, i) => `p${i}`);
  const counts = randomRoles(players, r);
  const deck = ROLE_IDS.flatMap((role) => Array<RoleId>(counts[role] ?? 0).fill(role)).sort(() => r() - 0.5);
  const setup = {
    players: ids.map((id) => ({ id, name: id })),
    roles: Object.fromEntries(ids.map((id, i) => [id, deck[i]!])),
    rules: pick(RULE_VARIANTS, r),
  };
  let game = newGame(setup);
  for (let moves = 0; moves < 60; moves++) {
    const { states } = replay(game.setup, game.steps.slice(0, game.cursor));
    const state = states.at(-1)!;
    const rules = rulesOf(setup);
    const living = ids.filter((id) => state.alive[id]);
    if (!living.length || winnerOf(setup, state, rules)) break;

    let step: Step;
    if (phaseOf(game.cursor).kind === 'night') {
      const actions: Record<string, string | null> = {};
      for (const p of nightPrompts(setup, state, phaseOf(game.cursor).number, rules)) {
        // Deliberately include some invalid targets (dead players): replay must cope.
        actions[p.key] = r() < 0.1 ? pick(ids, r) : r() < 0.8 ? pick(living, r) : null;
      }
      step = { kind: 'night', actions };
    } else {
      step = { kind: 'day', eliminated: r() < 0.7 ? [pick(living, r)] : [], mayorRevealed: r() < 0.1 };
    }
    if (r() < 0.05) step.adjust = { [pick(ids, r)]: r() < 0.5 };
    game = setStep(game, game.cursor, step);

    const back = r();
    game = back < 0.1 && game.cursor > 0 ? goTo(game, game.cursor - 1 - Math.floor(r() * game.cursor)) : goTo(game, game.cursor + 1);
    const result = replay(game.setup, game.steps);
    expect(result.states).toHaveLength(game.steps.length + 1);
    for (const s of result.states) for (const d of s.deaths) expect(s.alive[d.player]).toBe(false);
  }
}

describe('fuzz: online rooms', () => {
  const CHUNK = 20;
  const offset = Number(process.env.FUZZ_SEED ?? 0);
  const all: ReturnType<typeof playOnline>[] = [];
  for (let start = 0; start < GAMES; start += CHUNK) {
    const count = Math.min(CHUNK, GAMES - start);
    it(`plays games ${start + 1}-${start + count} to the end without getting stuck, crashing or leaking roles`, () => {
      for (let i = 0; i < count; i++) all.push(playOnline(offset + start + i + 1));
    }, 120_000);
  }
  it('reaches more than one kind of ending', () => {
    expect(new Set(all.map((g) => g.winner)).size).toBeGreaterThan(1);
    if (process.env.FUZZ_REPORT) {
      const tally = (k: (g: (typeof all)[number]) => string) => all.reduce<Record<string, number>>((a, g) => ({ ...a, [k(g)]: (a[k(g)] ?? 0) + 1 }), {});
      console.log('winners', tally((g) => String(g.winner)), 'styles', tally((g) => g.style), 'max loops', Math.max(...all.map((g) => g.loops)));
    }
  });
});

describe('fuzz: Mode 1 tracker', () => {
  it(`replays ${GAMES * 2} random tracker games with back-and-forth edits`, () => {
    for (let i = 1; i <= GAMES * 2; i++) playTracker(i);
  }, 600_000);
});
