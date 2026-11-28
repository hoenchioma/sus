// Anonymous game records for long-term stats: who played which role, what they did, and who won.
// Players appear by seat number; the server turns each name into a scrambled code before anything is stored.
import { balance } from './mafia/balance';
import { phaseOf, replay, roleCounts, rulesOf, winnerOf } from './mafia/game';
import type { Ballot, Prediction, Room, RoomSettings } from './mafia/online';
import { ROLE_IDS, ROLES, teamOf } from './mafia/roles';
import type { Game, PlayerId, Setup, Step, Winner } from './mafia/types';
import { questBalance } from './quest/balance';
import { questRulesOf, replayQuest, type QuestSetup, type QuestStep } from './quest/game';
import type { QuestRoom } from './quest/online';
import { QUEST_ROLES, sideOf } from './quest/roles';
import { MAX_QUEST_PLAYERS, MIN_QUEST_PLAYERS } from './quest/tables';

/** Bump when the shape of `settings`, `timeline` or the per-seat `stats` changes. */
export const RECORD_VERSION = 1;

export interface SeatRecord {
  seat: number;
  /** Only for the server to derive the name code from. Never stored. */
  name: string;
  device: string | null;
  host: boolean;
  role: string;
  team: string;
  won: boolean;
  /** Mafia only. */
  survived: boolean | null;
  diedRound: number | null;
  diedPhase: 'night' | 'day' | null;
  diedCause: string | null;
  stats: Record<string, number>;
}

export interface GameRecord {
  id: string;
  family: 'mafia' | 'quest';
  /** `phones`: everyone on their phone. `tracker`: one phone, run by the host. */
  source: 'phones' | 'tracker';
  skin: string;
  test: boolean;
  startedAt: number | null;
  endedAt: number;
  players: number;
  /** `none` when the host stopped the game early. */
  winner: string;
  endReason: string;
  /** Mafia: nights played. Quest: chapters played. */
  rounds: number;
  balance: number | null;
  settings: unknown;
  timeline: unknown;
  version: number;
  seats: SeatRecord[];
}

interface Meta {
  id: string;
  skin: string;
  test: boolean;
  startedAt: number | null;
  endedAt: number;
}

const add = (stats: Record<string, number>, key: string, by = 1) => {
  stats[key] = (stats[key] ?? 0) + by;
};

/* ---------- Mafia ---------- */

interface MafiaInput {
  source: GameRecord['source'];
  setup: Setup;
  steps: Step[];
  winner: Winner;
  endedByHost: boolean;
  ballots: Ballot[];
  killVotes: { night: number; by: PlayerId; target: PlayerId | null }[];
  predictions: Prediction[];
  settings: Partial<Omit<RoomSettings, 'counts' | 'rules' | 'skin'>>;
  hostId: PlayerId | null;
  devices: Record<PlayerId, string | undefined>;
}

function mafiaRecord(meta: Meta, input: MafiaInput): GameRecord {
  const { setup, steps } = input;
  const seat = new Map(setup.players.map((p, i) => [p.id, i]));
  const s = (id: PlayerId | null | undefined) => (id ? seat.get(id) ?? null : null);
  const seats = (ids: PlayerId[] | undefined) => ids?.map((id) => s(id));
  const rules = rulesOf(setup);
  const final = replay(setup, steps).states.at(-1)!;
  const teamOfSeat = (id: PlayerId) => teamOf(setup.roles[id]!);

  const won = (id: PlayerId) => {
    if (input.endedByHost) return false;
    const role = setup.roles[id]!;
    if (role === 'jester') return final.jesterWon;
    if (role === 'serialKiller') return input.winner === 'serialKiller';
    return input.winner === teamOfSeat(id);
  };

  const stats = new Map(setup.players.map((p) => [p.id, {} as Record<string, number>]));
  for (const b of input.ballots) {
    const voter = stats.get(b.voter);
    if (!voter) continue;
    if (b.ghost) add(voter, 'ghostVotes');
    if (!b.target) {
      add(voter, 'skips');
      continue;
    }
    add(voter, 'votes');
    add(voter, `votesOn_${teamOfSeat(b.target)}`);
    if (b.target === b.voter) add(voter, 'votesOnSelf');
    const target = stats.get(b.target);
    if (target) add(target, 'votesReceived');
  }
  for (const k of input.killVotes) {
    const by = stats.get(k.by);
    if (by && k.target) add(by, 'killVotes');
  }
  for (const p of input.predictions) {
    const by = stats.get(p.by);
    if (!by) continue;
    let right: boolean;
    if (p.kind === 'predictRole') {
      right = setup.roles[p.target] === p.role;
      add(by, 'roleGuesses');
      if (right) add(by, 'roleGuessesRight');
    } else {
      const death = final.deaths.find((d) => d.player === p.target);
      right = !!death && steps[death.step]?.kind === 'night' && phaseOf(death.step).number === p.night;
      add(by, 'deathGuesses');
      if (right) add(by, 'deathGuessesRight');
    }
  }
  // What each role did at night, by seat, so per-player tendencies (e.g. a Doctor who saves themselves) can be studied.
  steps.forEach((step) => {
    if (step.kind !== 'night') return;
    for (const [key, target] of Object.entries(step.actions)) {
      if (!target || key === 'mafia') continue;
      const holder = setup.players.find((p) => ROLES[setup.roles[p.id]!].prompt === key);
      if (holder) add(stats.get(holder.id)!, 'nightActions');
    }
  });

  const timeline = {
    steps: steps.map((step) =>
      step.kind === 'night'
        ? {
            kind: 'night',
            actions: Object.fromEntries(Object.entries(step.actions).map(([k, v]) => [k, s(v)])),
            overrideDeaths: seats(step.overrideDeaths),
            adjust: step.adjust ? Object.fromEntries(Object.entries(step.adjust).map(([id, alive]) => [s(id), alive])) : undefined,
          }
        : {
            kind: 'day',
            eliminated: seats(step.eliminated),
            mayorRevealed: step.mayorRevealed,
            ghostVotes: seats(step.ghostVotes),
            adjust: step.adjust ? Object.fromEntries(Object.entries(step.adjust).map(([id, alive]) => [s(id), alive])) : undefined,
          },
    ),
    deaths: final.deaths.map((d) => ({ seat: s(d.player), cause: d.cause, step: d.step })),
    ballots: input.ballots.map((b) => ({ day: b.day, runoff: b.runoff, voter: s(b.voter), target: s(b.target), ghost: b.ghost })),
    killVotes: input.killVotes.map((k) => ({ night: k.night, by: s(k.by), target: s(k.target) })),
    predictions: input.predictions.map((p) => ({ night: p.night, by: s(p.by), kind: p.kind, role: p.role, target: s(p.target) })),
  };

  const counts = roleCounts(setup);
  return {
    ...meta,
    family: 'mafia',
    source: input.source,
    players: setup.players.length,
    winner: input.endedByHost ? 'none' : input.winner,
    endReason: input.endedByHost ? 'host' : final.jesterWon && input.winner === 'jester' ? 'jester' : 'win',
    rounds: steps.filter((st) => st.kind === 'night').length,
    balance: balance(counts, setup.rules).score,
    settings: { roles: counts, rules, ...input.settings },
    timeline,
    version: RECORD_VERSION,
    seats: setup.players.map((p, i) => {
      const death = final.deaths.find((d) => d.player === p.id);
      return {
        seat: i,
        name: p.name,
        device: input.devices[p.id] ?? null,
        host: p.id === input.hostId,
        role: setup.roles[p.id]!,
        team: teamOfSeat(p.id),
        won: won(p.id),
        survived: !death,
        diedRound: death ? phaseOf(death.step).number : null,
        diedPhase: death ? phaseOf(death.step).kind : null,
        diedCause: death?.cause ?? null,
        stats: stats.get(p.id)!,
      };
    }),
  };
}

/** A finished phone game of Mafia/Werewolf, or null if the room isn't over. */
export function mafiaRoomRecord(room: Room, meta: Omit<Meta, 'skin' | 'test' | 'startedAt' | 'id'>): GameRecord | null {
  if (room.phase !== 'over' || !room.setup || !room.winner) return null;
  const { nightStyle, discussionSeconds, sleepSeconds, preset } = room.settings;
  return mafiaRecord(
    { ...meta, id: room.gameId ?? `${room.code}-${room.createdAt}`, skin: room.settings.skin, test: room.members.some((m) => m.test), startedAt: room.startedAt ?? null },
    {
      source: 'phones',
      setup: room.setup,
      steps: room.steps,
      winner: room.winner,
      endedByHost: room.endedByHost,
      ballots: room.ballots ?? [],
      killVotes: room.killVotes ?? [],
      predictions: room.predictions,
      settings: { nightStyle, discussionSeconds, sleepSeconds, preset },
      hostId: room.hostId,
      devices: Object.fromEntries(room.members.map((m) => [m.id, m.device])),
    },
  );
}

/** A finished one-phone Mafia game (the host tracker). */
export function mafiaTrackerRecord(game: Game, meta: Meta): GameRecord | null {
  if (!game.ended) return null;
  return mafiaRecord(meta, {
    source: 'tracker',
    setup: game.setup,
    steps: game.steps.slice(0, game.cursor + 1),
    winner: game.ended,
    endedByHost: false,
    ballots: [],
    killVotes: [],
    predictions: [],
    settings: {},
    hostId: null,
    devices: {},
  });
}

/* ---------- Polashi / Avalon ---------- */

interface QuestInput {
  source: GameRecord['source'];
  setup: QuestSetup;
  steps: QuestStep[];
  endedByHost: boolean;
  settings: Record<string, unknown>;
  hostId: PlayerId | null;
  devices: Record<PlayerId, string | undefined>;
}

function questRecord(meta: Meta, input: QuestInput): GameRecord | null {
  const { setup, steps } = input;
  const replayed = replayQuest(setup, steps);
  const final = replayed.states.at(-1)!;
  if (final.phase !== 'over' && !input.endedByHost) return null;
  const seat = new Map(setup.players.map((p, i) => [p.id, i]));
  const s = (id: PlayerId) => seat.get(id) ?? null;
  const evil = (id: PlayerId) => sideOf(setup.roles[id]!) === 'evil';

  const stats = new Map(setup.players.map((p) => [p.id, {} as Record<string, number>]));
  for (const v of final.votes) {
    add(stats.get(v.commander)!, 'commanded');
    if (v.approved) add(stats.get(v.commander)!, 'proposalsApproved');
    const evilTeam = v.team.some(evil);
    for (const id of v.team) add(stats.get(id)!, 'proposedFor');
    for (const [id, approve] of Object.entries(v.votes)) {
      const st = stats.get(id);
      if (!st) continue;
      add(st, approve ? 'approves' : 'rejects');
      if (approve && evilTeam) add(st, 'approvedEvilTeams');
      if (!approve && !evilTeam) add(st, 'rejectedGoodTeams');
    }
  }
  for (const r of final.results) {
    for (const id of r.team) {
      add(stats.get(id)!, 'chapters');
      if (r.winner === 'evil') add(stats.get(id)!, 'chaptersLost');
    }
  }
  for (const step of steps) {
    if (step.kind === 'chapter') for (const [id, card] of Object.entries(step.plays)) if (card === 'betray') add(stats.get(id)!, 'betrayals');
  }
  for (const c of final.spyChecks) add(stats.get(c.spy)!, 'spyChecks');

  const timeline = {
    steps: steps.map((step) => {
      switch (step.kind) {
        case 'propose':
          return { kind: 'propose', team: step.team.map(s) };
        case 'vote':
          return { kind: 'vote', votes: Object.fromEntries(Object.entries(step.votes).map(([id, v]) => [s(id), v])) };
        case 'chapter':
          return { kind: 'chapter', plays: Object.fromEntries(Object.entries(step.plays).map(([id, v]) => [s(id), v])) };
        default:
          return { kind: step.kind, target: s(step.target) };
      }
    }),
    results: final.results.map((r) => ({ chapter: r.chapter, team: r.team.map(s), betrayals: r.betrayals, winner: r.winner })),
    spyChecks: final.spyChecks.map((c) => ({ spy: s(c.spy), target: s(c.target), side: c.side, afterChapter: c.afterChapter })),
    guess: final.guess ? s(final.guess) : null,
  };

  const winner = input.endedByHost || final.phase !== 'over' ? null : final.winner;
  return {
    ...meta,
    family: 'quest',
    source: input.source,
    players: setup.players.length,
    winner: winner ?? 'none',
    endReason: winner ? final.reason ?? 'chapters' : 'host',
    rounds: final.results.length,
    balance: questBalance(setup.rules, setup.players.length).score,
    settings: { rules: questRulesOf(setup), firstCommander: setup.firstCommander, ...input.settings },
    timeline,
    version: RECORD_VERSION,
    seats: setup.players.map((p, i) => ({
      seat: i,
      name: p.name,
      device: input.devices[p.id] ?? null,
      host: p.id === input.hostId,
      role: setup.roles[p.id]!,
      team: sideOf(setup.roles[p.id]!),
      won: !!winner && sideOf(setup.roles[p.id]!) === winner,
      survived: null,
      diedRound: null,
      diedPhase: null,
      diedCause: null,
      stats: stats.get(p.id)!,
    })),
  };
}

/** A finished phone game of Polashi/Avalon, or null if the room isn't over. */
export function questRoomRecord(room: QuestRoom, meta: Omit<Meta, 'skin' | 'test' | 'startedAt' | 'id'>): GameRecord | null {
  if (room.phase !== 'over' || !room.setup) return null;
  return questRecord(
    { ...meta, id: room.gameId ?? `${room.code}-${room.createdAt}`, skin: room.settings.skin, test: room.members.some((m) => m.test), startedAt: room.startedAt ?? null },
    {
      source: 'phones',
      setup: room.setup,
      steps: room.steps,
      endedByHost: room.endedByHost,
      settings: { preset: room.settings.preset, discussionSeconds: room.settings.discussionSeconds },
      hostId: room.hostId,
      devices: Object.fromEntries(room.members.map((m) => [m.id, m.device])),
    },
  );
}

/** A finished one-phone Polashi/Avalon game. */
export const questTrackerRecord = (setup: QuestSetup, steps: QuestStep[], meta: Meta) =>
  questRecord(meta, { source: 'tracker', setup, steps, endedByHost: false, settings: {}, hostId: null, devices: {} });

/* ---------- one-phone uploads ---------- */

/** What a phone sends after a one-phone game ends. */
export type TrackerUpload =
  | { family: 'mafia'; id: string; skin: string; test?: boolean; startedAt?: number | null; game: Game }
  | { family: 'quest'; id: string; skin: string; test?: boolean; startedAt?: number | null; setup: QuestSetup; steps: QuestStep[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const okPlayers = (players: unknown, min: number, max: number) =>
  Array.isArray(players) &&
  players.length >= min &&
  players.length <= max &&
  players.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string' && p.name.length <= 40) &&
  new Set(players.map((p) => (p as { id: string }).id)).size === players.length;

/**
 * Checks a one-phone upload (which comes from anyone on the internet) and turns it into a record, or explains
 * why not. The game must replay cleanly and actually be over.
 */
export function trackerRecord(body: unknown, endedAt: number): GameRecord | string {
  if (!isObject(body)) return 'Bad upload';
  const { id, skin, test, startedAt } = body;
  if (typeof id !== 'string' || !/^[\w-]{8,64}$/.test(id)) return 'Bad id';
  if (typeof skin !== 'string' || !/^\w{1,20}$/.test(skin)) return 'Bad skin';
  if (startedAt !== undefined && startedAt !== null && (typeof startedAt !== 'number' || startedAt > endedAt)) return 'Bad start time';
  const meta: Meta = { id, skin, test: test === true, startedAt: (startedAt as number | undefined) ?? null, endedAt };

  try {
    if (body.family === 'mafia') {
      const game = body.game;
      if (!isObject(game) || !isObject(game.setup) || !Array.isArray(game.steps) || game.steps.length > 200) return 'Bad game';
      const setup = game.setup as unknown as Setup;
      if (!okPlayers(setup.players, 3, 30) || !isObject(setup.roles) || !isObject(setup.rules)) return 'Bad setup';
      if (!setup.players.every((p) => (ROLE_IDS as string[]).includes(setup.roles[p.id] as string))) return 'Bad roles';
      const g = game as unknown as Game;
      if (typeof g.cursor !== 'number' || g.cursor < 0 || g.cursor >= g.steps.length) return 'Bad cursor';
      const steps = g.steps.slice(0, g.cursor + 1);
      if (!steps.every((st) => isObject(st) && (st.kind === 'night' || st.kind === 'day'))) return 'Bad steps';
      const final = replay(setup, steps).states.at(-1)!;
      if (!g.ended || winnerOf(setup, final, rulesOf(setup)) !== g.ended) return 'The game is not over';
      return mafiaTrackerRecord(g, meta)!;
    }
    if (body.family === 'quest') {
      const setup = body.setup as QuestSetup;
      if (!isObject(setup) || !okPlayers(setup.players, MIN_QUEST_PLAYERS, MAX_QUEST_PLAYERS) || !isObject(setup.roles)) return 'Bad setup';
      if (!setup.players.every((p) => setup.roles[p.id]! in QUEST_ROLES)) return 'Bad roles';
      if (!Array.isArray(body.steps) || body.steps.length > 200) return 'Bad steps';
      const steps = body.steps as QuestStep[];
      const replayed = replayQuest(setup, steps);
      if (replayed.problem) return replayed.problem;
      return questTrackerRecord(setup, steps, meta) ?? 'The game is not over';
    }
  } catch {
    return 'Bad game';
  }
  return 'Unknown game';
}
