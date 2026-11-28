import { balance, setupProblems } from './balance';
import { phaseOf, replay, rulesOf, voteInfo, winnerOf } from './game';
import { detectiveResult, holdersOf, nightPrompts, targetProblem } from './night';
import { ROLES, teamOf, type PromptKey, type RoleId, type Team } from './roles';
import { callDeadRoles, type PresetId, type RoleCounts, type RuleChoices } from './rules';
import { dealRoles, suggestedRoles, suggestedRules } from './setup';
import type { Adjustments, DayStep, NightActions, NightStep, PlayerId, Setup, State, Step, Winner } from './types';

export type { Setup };

export type NightStyle = 'quick' | 'narrated';

export interface RoomSettings {
  counts: RoleCounts;
  rules: RuleChoices;
  preset: PresetId;
  skin: string;
  nightStyle: NightStyle;
  sleepSeconds: number;
  discussionSeconds: number;
}

export interface Member {
  id: PlayerId;
  name: string;
  token: string;
  connected: boolean;
  lastSeen: number;
  absent: boolean;
  /** Random per-phone ID for stats, so the same phone can be recognised across games. */
  device?: string;
  /** Set by the simulated-game tests so their games can be left out of stats. */
  test?: boolean;
}

export type CardKind = 'action' | 'predictDeath' | 'predictRole';

export interface NightCard {
  kind: CardKind;
  key?: PromptKey;
  role?: RoleId;
  /** `undefined` = not answered yet, `null` = no action. */
  target?: PlayerId | null;
}

export interface NightProgress {
  number: number;
  cards: Record<PlayerId, NightCard[]>;
  mafiaVotes: Record<PlayerId, PlayerId | null>;
  chat: { from: PlayerId; text: string }[];
  /** Narrated only. */
  ready: PlayerId[];
  /** Narrated only: awake players who tapped Done for the current role. */
  done: PlayerId[];
  queue: { key: PromptKey; fake: boolean }[];
  current: number;
  stage: 'ready' | 'awake' | 'sleep' | 'pause';
}

export interface DayProgress {
  number: number;
  stage: 'discussion' | 'vote' | 'runoff' | 'hostPick' | 'result';
  votes: Record<PlayerId, PlayerId | 'skip'>;
  ghostVotes: Record<PlayerId, PlayerId>;
  candidates: PlayerId[];
  /** Ghosts who have cast their one vote today (kept across the runoff). */
  ghostsUsed: PlayerId[];
  lastBallots: { voter: string; target: string | null; ghost?: boolean }[];
  mayorRevealed: boolean;
  tally: { player: PlayerId; votes: number }[];
  eliminated: PlayerId[];
}

export interface AnnouncementEntry {
  name: string;
  role?: RoleId;
  team?: Team;
  note?: 'heartbreak' | 'partner' | 'code';
  text?: string;
}

export interface Announcement {
  seq: number;
  kind: 'morning' | 'vote' | 'mayor' | 'host';
  title: string;
  entries: AnnouncementEntry[];
}

export interface Prediction {
  night: number;
  by: PlayerId;
  kind: 'predictDeath' | 'predictRole';
  role?: RoleId;
  target: PlayerId;
}

/** One vote in a day's vote or runoff, kept for stats. */
export interface Ballot {
  day: number;
  runoff: boolean;
  voter: PlayerId;
  /** `null` = skipped. */
  target: PlayerId | null;
  ghost?: boolean;
}

export interface Room {
  code: string;
  createdAt: number;
  members: Member[];
  hostId: PlayerId | null;
  hostLostAt: number | null;
  settings: RoomSettings;
  phase: 'lobby' | 'reveal' | 'night' | 'day' | 'over';
  setup: Setup | null;
  steps: Step[];
  revealed: PlayerId[];
  night: NightProgress | null;
  day: DayProgress | null;
  pendingAdjust: Adjustments;
  predictions: Prediction[];
  winner: Winner | null;
  endedByHost: boolean;
  deadline: number | null;
  pausedRemaining: number | null;
  announcement: Announcement | null;
  cue: { seq: number; id: string } | null;
  confirmRemove: { player: PlayerId; winner: Winner } | null;
  rejoinCodes: Record<string, PlayerId>;
  tvConnected: boolean;
  /** Identifies one game in this room for stats; a new one each time roles are dealt. */
  gameId?: string;
  startedAt?: number;
  /** Every day's ballots, by player ID (the view's `lastBallots` only holds the latest round, by name). */
  ballots?: Ballot[];
  /** Each Mafia member's kill vote per night. */
  killVotes?: { night: number; by: PlayerId; target: PlayerId | null }[];
  /** The server's note that this game's result has been saved to stats. */
  recorded?: string;
}

export type Command =
  | { type: 'join'; name: string }
  | { type: 'leave'; successor?: PlayerId }
  | { type: 'configure'; settings: Partial<RoomSettings> }
  | { type: 'start' }
  | { type: 'seenRole' }
  | { type: 'ready' }
  | { type: 'pick'; card: number; target: PlayerId | null }
  | { type: 'done' }
  | { type: 'chat'; text: string }
  | { type: 'vote'; target: PlayerId | 'skip' }
  | { type: 'revealMayor' }
  | { type: 'admin'; action: AdminAction };

export type AdminAction =
  | { kind: 'kick'; player: PlayerId }
  | { kind: 'remove'; player: PlayerId; confirm?: boolean }
  | { kind: 'cancelRemove' }
  | { kind: 'rejoinCode'; player: PlayerId }
  | { kind: 'transferHost'; player: PlayerId }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'extend' }
  | { kind: 'skip' }
  | { kind: 'hostPick'; player: PlayerId | null }
  | { kind: 'continue' }
  | { kind: 'end' }
  | { kind: 'rematch' };

export interface Env {
  now: number;
  random: () => number;
  id: () => string;
}

export const HOST_GRACE_MS = 60_000;
export const ABSENT_AFTER_MS = 45_000;
const RESULT_MS = 10_000;

export function createRoom(code: string, now: number): Room {
  return {
    code,
    createdAt: now,
    members: [],
    hostId: null,
    hostLostAt: null,
    settings: {
      counts: {},
      rules: {},
      preset: 'classic',
      skin: 'mafia',
      nightStyle: 'quick',
      sleepSeconds: 3,
      discussionSeconds: 180,
    },
    phase: 'lobby',
    setup: null,
    steps: [],
    revealed: [],
    night: null,
    day: null,
    pendingAdjust: {},
    predictions: [],
    winner: null,
    endedByHost: false,
    deadline: null,
    pausedRemaining: null,
    announcement: null,
    cue: null,
    confirmRemove: null,
    rejoinCodes: {},
    tvConnected: false,
  };
}

export const gameState = (room: Room): State | null =>
  room.setup ? replay(room.setup, room.steps).states.at(-1)! : null;

const isActive = (m: Member) => !m.absent;
const memberName = (room: Room, id: PlayerId) => room.members.find((m) => m.id === id)?.name ?? '?';

function announce(room: Room, kind: Announcement['kind'], title: string, entries: AnnouncementEntry[] = []) {
  room.announcement = { seq: (room.announcement?.seq ?? 0) + 1, kind, title, entries };
}

function cue(room: Room, id: string) {
  room.cue = { seq: (room.cue?.seq ?? 0) + 1, id };
}

function livingActive(room: Room, state: State) {
  return room.members.filter((m) => state.alive[m.id] && isActive(m)).map((m) => m.id);
}

/* ---------- joining & connection ---------- */

export function join(room: Room, name: string, env: Env): Member | string {
  const clean = name.trim().slice(0, 20);
  if (!clean) return 'Enter a name';
  if (room.phase !== 'lobby') return 'This game has already started';
  if (room.members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) return 'That name is taken';
  if (room.members.length >= 20) return 'The room is full';
  const member: Member = { id: env.id(), name: clean, token: env.id(), connected: true, lastSeen: env.now, absent: false };
  room.members.push(member);
  room.hostId ??= member.id;
  syncCounts(room);
  return member;
}

export function useRejoinCode(room: Room, code: string, env: Env): Member | null {
  const id = room.rejoinCodes[code.toUpperCase()];
  const member = room.members.find((m) => m.id === id);
  if (!member) return null;
  delete room.rejoinCodes[code.toUpperCase()];
  member.token = env.id();
  member.absent = false;
  member.connected = true;
  return member;
}

export function setConnected(room: Room, playerId: PlayerId, connected: boolean, now: number) {
  const member = room.members.find((m) => m.id === playerId);
  if (!member) return;
  member.connected = connected;
  member.lastSeen = now;
  if (connected) member.absent = false;
  if (playerId === room.hostId) room.hostLostAt = connected ? null : now;
}

/** Who is in a room, independent of the game being played there. */
export interface RoomPeople {
  code: string;
  createdAt: number;
  members: Member[];
  hostId: PlayerId | null;
  hostLostAt: number | null;
  rejoinCodes: Record<string, PlayerId>;
  tvConnected: boolean;
}

/** The people to carry into the next game: everyone still around, with the host kept if they are. */
export function peopleOf(room: RoomPeople): RoomPeople {
  const members = room.members.filter((m) => !m.absent).map((m) => ({ ...m, absent: false }));
  const hostStays = members.some((m) => m.id === room.hostId);
  return {
    code: room.code,
    createdAt: room.createdAt,
    members,
    hostId: hostStays ? room.hostId : members.find((m) => m.connected)?.id ?? members[0]?.id ?? null,
    hostLostAt: hostStays ? room.hostLostAt : null,
    rejoinCodes: { ...room.rejoinCodes },
    tvConnected: room.tvConnected,
  };
}

/** A fresh Mafia lobby holding the same people, so switching games doesn't make anyone rejoin. */
export function roomWithPeople(people: RoomPeople): Room {
  const room = createRoom(people.code, people.createdAt);
  Object.assign(room, peopleOf(people));
  syncCounts(room);
  return room;
}

function syncCounts(room: Room) {
  if (room.phase !== 'lobby') return;
  const total = Object.values(room.settings.counts).reduce((a, b) => a + (b ?? 0), 0);
  if (total !== room.members.length && room.members.length >= 5) {
    room.settings.counts = suggestedRoles(room.members.length);
    room.settings.rules = { ...room.settings.rules, ...suggestedRules(room.members.length) };
  }
}

/* ---------- night ---------- */

function startNight(room: Room, env: Env) {
  const setup = room.setup!;
  const state = gameState(room)!;
  const number = phaseOf(room.steps.length).number;
  room.phase = 'night';
  room.day = null;
  room.night = {
    number,
    cards: {},
    mafiaVotes: {},
    chat: [],
    ready: [],
    done: [],
    queue: [],
    current: 0,
    stage: room.settings.nightStyle === 'narrated' ? 'ready' : 'awake',
  };
  room.deadline = null;

  if (room.settings.nightStyle === 'quick') {
    const rules = rulesOf(setup);
    const active = new Map(nightPrompts(setup, state, number, rules).filter((p) => !p.disabled).map((p) => [p.key, p]));
    const inPlay = [...new Set(Object.values(setup.roles))].filter((r) => r !== 'villager');
    const living = livingActive(room, state);
    const killers = living.filter((id) => teamOf(setup.roles[id]!) === 'mafia' && setup.roles[id] !== 'roleblocker');
    for (const id of living) {
      const role = setup.roles[id]!;
      const key: PromptKey | undefined = teamOf(role) === 'mafia' && role !== 'roleblocker' ? 'mafia' : ROLES[role].prompt;
      const first: NightCard = key && active.has(key) ? { kind: 'action', key } : { kind: 'predictDeath' };
      // With no other Mafia left, the Roleblocker makes the kill as their second card (still two cards).
      if (role === 'roleblocker' && killers.length === 0 && active.has('mafia')) {
        room.night.cards[id] = [first, { kind: 'action', key: 'mafia' }];
        continue;
      }
      const known = (r: RoleId) => r === role || (teamOf(role) === 'mafia' && teamOf(r) === 'mafia');
      const pool = inPlay.filter((r) => !known(r));
      const guess = pool[Math.floor(env.random() * pool.length)] ?? 'villager';
      room.night.cards[id] = [first, { kind: 'predictRole', role: guess }];
    }
  } else {
    const rules = rulesOf(setup);
    const call = callDeadRoles(rules);
    room.night.queue = nightPrompts(setup, state, number, rules)
      .filter((p) => p.alive || call)
      .map((p) => ({ key: p.key, fake: !p.alive || !!p.disabled }));
  }
  cue(room, 'night');
}

function holdersAwake(room: Room, key: PromptKey, state: State) {
  return holdersOf(room.setup!, key).filter((id) => state.alive[id] && !room.members.find((m) => m.id === id)?.absent);
}

function wakeCurrent(room: Room, env: Env) {
  const night = room.night!;
  const entry = night.queue[night.current];
  if (!entry) return finishNight(room, env);
  const state = gameState(room)!;
  night.stage = 'awake';
  cue(room, `wake:${entry.key}`);
  if (entry.fake) {
    room.deadline = env.now + 5000 + Math.floor(env.random() * 5000);
    return;
  }
  room.deadline = null;
  night.done = [];
  for (const id of holdersAwake(room, entry.key, state)) {
    const key = entry.key === 'mafia' ? 'mafia' : entry.key;
    night.cards[id] = [...(night.cards[id] ?? []), { kind: 'action', key }];
  }
}

function sleepCurrent(room: Room, env: Env) {
  const night = room.night!;
  const entry = night.queue[night.current];
  night.stage = 'sleep';
  if (entry) cue(room, `sleep:${entry.key}`);
  room.deadline = env.now + room.settings.sleepSeconds * 1000;
}

function mafiaKill(room: Room, state: State, random: () => number): PlayerId | null {
  const setup = room.setup!;
  const night = room.night!;
  const godfather = room.members.find((m) => setup.roles[m.id] === 'godfather' && state.alive[m.id]);
  if (godfather && night.mafiaVotes[godfather.id] !== undefined) return night.mafiaVotes[godfather.id] ?? null;
  const counts = new Map<PlayerId, number>();
  for (const target of Object.values(night.mafiaVotes)) if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  if (!counts.size) return null;
  const top = Math.max(...counts.values());
  const tied = [...counts].filter(([, n]) => n === top).map(([id]) => id);
  return tied[Math.floor(random() * tied.length)]!;
}

function nightActions(room: Room, state: State, random: () => number): NightActions {
  const actions: NightActions = {};
  for (const cards of Object.values(room.night!.cards)) {
    for (const card of cards) {
      if (card.kind === 'action' && card.key && card.key !== 'mafia' && card.target !== undefined) actions[card.key] = card.target;
    }
  }
  actions.mafia = mafiaKill(room, state, random);
  return actions;
}

/** True when every awake player who has something to answer has answered it. */
function nightAnswered(room: Room, state: State): boolean {
  const night = room.night!;
  const waiting = (id: PlayerId) => night.cards[id]?.some((c) => c.target === undefined) ?? false;
  if (room.settings.nightStyle === 'quick') return livingActive(room, state).every((id) => !waiting(id));
  const entry = night.queue[night.current];
  if (!entry || entry.fake) return false;
  return holdersAwake(room, entry.key, state).every((id) => !waiting(id) && night.done.includes(id));
}

function afterAnswer(room: Room, env: Env) {
  const state = gameState(room)!;
  if (!nightAnswered(room, state)) return;
  if (room.settings.nightStyle === 'quick') {
    room.night!.stage = 'pause';
    room.deadline = env.now + 1500 + Math.floor(env.random() * 2500);
  } else {
    sleepCurrent(room, env);
  }
}

function finishNight(room: Room, env: Env) {
  const setup = room.setup!;
  const before = gameState(room)!;
  const night = room.night!;
  const step: NightStep = { kind: 'night', actions: nightActions(room, before, env.random) };
  if (Object.keys(room.pendingAdjust).length) step.adjust = room.pendingAdjust;
  room.pendingAdjust = {};
  for (const [by, cards] of Object.entries(night.cards)) {
    for (const card of cards) {
      if ((card.kind === 'predictDeath' || card.kind === 'predictRole') && card.target) {
        room.predictions.push({ night: night.number, by, kind: card.kind, role: card.role, target: card.target });
      }
    }
  }
  for (const [by, target] of Object.entries(night.mafiaVotes)) (room.killVotes ??= []).push({ night: night.number, by, target });
  room.steps.push(step);
  const after = gameState(room)!;
  const rules = rulesOf(setup);
  const died = after.deaths.filter((d) => d.step === room.steps.length - 1);
  const entries = died.map((d) => revealed(room, d.player, d.cause === 'heartbreak' ? 'heartbreak' : undefined));
  if (after.loverPartner && after.alive[after.loverPartner]) {
    entries.push({ name: memberName(room, after.loverPartner), note: 'partner' });
  }
  announce(room, 'morning', died.length ? 'Not everyone woke up' : 'Everyone woke up', entries);
  cue(room, died.length ? 'dawn:death' : 'dawn');
  room.night = null;
  if (!checkWinner(room, after, rules)) startDay(room, env);
}

function revealed(room: Room, player: PlayerId, note?: AnnouncementEntry['note']): AnnouncementEntry {
  const setup = room.setup!;
  const rules = rulesOf(setup);
  const role = setup.roles[player]!;
  const name = memberName(room, player);
  if (rules.deathReveal === 'full') return { name, role, note };
  if (rules.deathReveal === 'team') return { name, team: teamOf(role), note };
  return { name, note };
}

/* ---------- day ---------- */

function startDay(room: Room, env: Env) {
  room.phase = 'day';
  room.day = {
    number: phaseOf(room.steps.length).number,
    stage: 'discussion',
    votes: {},
    ghostVotes: {},
    candidates: [],
    ghostsUsed: [],
    lastBallots: [],
    mayorRevealed: false,
    tally: [],
    eliminated: [],
  };
  room.deadline = env.now + room.settings.discussionSeconds * 1000;
}

function eligibleVoters(room: Room, state: State) {
  const info = voteInfo(room.setup!, state, rulesOf(room.setup!));
  return info.voters.filter((id) => !room.members.find((m) => m.id === id)?.absent);
}

function dayState(room: Room): State {
  const state = structuredClone(gameState(room)!);
  if (room.day?.mayorRevealed) state.mayorRevealed = true;
  return state;
}

function openVote(room: Room) {
  room.day!.stage = 'vote';
  room.deadline = null;
  cue(room, 'vote');
}

function weightOf(room: Room, state: State, voter: PlayerId) {
  return state.mayorRevealed && room.setup!.roles[voter] === 'mayor' ? 2 : 1;
}

function tallyVotes(room: Room, state: State) {
  const day = room.day!;
  const totals = new Map<PlayerId, number>();
  for (const [voter, target] of Object.entries(day.votes)) {
    if (target === 'skip') continue;
    if (day.stage === 'runoff' && !day.candidates.includes(target)) continue;
    totals.set(target, (totals.get(target) ?? 0) + weightOf(room, state, voter));
  }
  for (const target of Object.values(day.ghostVotes)) {
    if (day.stage === 'runoff' && !day.candidates.includes(target)) continue;
    totals.set(target, (totals.get(target) ?? 0) + 1);
  }
  return [...totals].map(([player, votes]) => ({ player, votes })).sort((a, b) => b.votes - a.votes);
}

function shuffle<T>(items: T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function closeVote(room: Room, env: Env) {
  const day = room.day!;
  const state = dayState(room);
  const rules = rulesOf(room.setup!);
  const tally = tallyVotes(room, state);
  day.tally = tally;
  day.lastBallots = [
    ...Object.entries(day.votes).map(([voter, target]) => ({ voter: memberName(room, voter), target: target === 'skip' ? null : memberName(room, target) })),
    ...Object.entries(day.ghostVotes).map(([voter, target]) => ({ voter: memberName(room, voter), target: memberName(room, target), ghost: true })),
  ];
  const runoff = day.stage === 'runoff';
  for (const [voter, target] of Object.entries(day.votes)) (room.ballots ??= []).push({ day: day.number, runoff, voter, target: target === 'skip' ? null : target });
  for (const [voter, target] of Object.entries(day.ghostVotes)) (room.ballots ??= []).push({ day: day.number, runoff, voter, target, ghost: true });
  const top = tally[0];
  if (!top) return finishDay(room, [], env);
  const tiedTop = tally.filter((t) => t.votes === top.votes);

  if (day.stage === 'vote') {
    const needed = voteInfo(room.setup!, state, rules).needed;
    if (tiedTop.length === 1 && (needed === null || top.votes >= needed)) return finishDay(room, [top.player], env);
    // Runoff between the top two. Shuffling before the (stable) sort breaks ties for a seat at random.
    day.candidates = shuffle(tally, env.random)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 2)
      .map((t) => t.player);
    if (day.candidates.length < 2) return finishDay(room, [], env);
    day.stage = 'runoff';
    day.ghostsUsed = [...new Set([...day.ghostsUsed, ...Object.keys(day.ghostVotes)])];
    day.votes = {};
    day.ghostVotes = {};
    cue(room, 'vote');
    return;
  }

  if (tiedTop.length === 1) return finishDay(room, [top.player], env);
  switch (rules.tieBreak) {
    case 'bothDie':
      return finishDay(room, day.candidates, env);
    case 'random':
      return finishDay(room, [day.candidates[Math.floor(env.random() * day.candidates.length)]!], env);
    case 'nobody':
      return finishDay(room, [], env);
    case 'host':
      day.stage = 'hostPick';
  }
}

function finishDay(room: Room, eliminated: PlayerId[], env: Env) {
  const day = room.day!;
  const step: DayStep = {
    kind: 'day',
    eliminated,
    mayorRevealed: day.mayorRevealed || undefined,
    ghostVotes: [...new Set([...day.ghostsUsed, ...Object.keys(day.ghostVotes)])],
  };
  if (Object.keys(room.pendingAdjust).length) step.adjust = room.pendingAdjust;
  room.pendingAdjust = {};
  room.steps.push(step);
  day.stage = 'result';
  day.eliminated = eliminated;
  const after = gameState(room)!;
  const extra = after.deaths.filter((d) => d.step === room.steps.length - 1 && !eliminated.includes(d.player));
  announce(
    room,
    'vote',
    eliminated.length ? `${eliminated.map((id) => memberName(room, id)).join(' & ')} ${eliminated.length > 1 ? 'are' : 'is'} out` : 'Nobody was voted out',
    [...eliminated.map((id) => revealed(room, id)), ...extra.map((d) => revealed(room, d.player, 'heartbreak'))],
  );
  cue(room, eliminated.length ? 'result:death' : 'result');
  if (!checkWinner(room, after, rulesOf(room.setup!))) room.deadline = env.now + RESULT_MS;
}

function afterVote(room: Room, env: Env) {
  const state = dayState(room);
  const voters = eligibleVoters(room, state);
  if (voters.every((id) => room.day!.votes[id] !== undefined)) closeVote(room, env);
}

/* ---------- end ---------- */

function checkWinner(room: Room, state: State, rules: ReturnType<typeof rulesOf>): boolean {
  const winner = winnerOf(room.setup!, state, rules);
  if (!winner) return false;
  endGame(room, winner);
  return true;
}

function endGame(room: Room, winner: Winner) {
  room.phase = 'over';
  room.winner = winner;
  room.deadline = null;
  room.night = null;
  cue(room, 'win');
}

/* ---------- commands ---------- */

export function apply(room: Room, playerId: PlayerId, cmd: Command, env: Env): string | null {
  const member = room.members.find((m) => m.id === playerId);
  if (!member) return 'Unknown player';
  member.lastSeen = env.now;
  const isHost = room.hostId === playerId;
  const state = gameState(room);

  switch (cmd.type) {
    case 'join':
      return 'Already joined';

    case 'leave': {
      if (room.phase === 'lobby') {
        room.members = room.members.filter((m) => m.id !== playerId);
      } else {
        member.absent = true;
        member.connected = false;
      }
      if (isHost) {
        const next = room.members.find((m) => m.id === cmd.successor && !m.absent) ?? room.members.find((m) => m.connected && !m.absent && m.id !== playerId);
        room.hostId = next?.id ?? null;
        room.hostLostAt = null;
        if (next) announce(room, 'host', `${next.name} is now the host`);
      }
      syncCounts(room);
      afterPresenceChange(room, env);
      return null;
    }

    case 'configure': {
      if (!isHost) return 'Only the host can change settings';
      if (room.phase !== 'lobby') return 'The game has started';
      room.settings = { ...room.settings, ...cmd.settings };
      room.settings.sleepSeconds = Math.max(3, Math.min(10, room.settings.sleepSeconds));
      room.settings.discussionSeconds = Math.max(30, Math.min(900, room.settings.discussionSeconds));
      return null;
    }

    case 'start': {
      if (!isHost) return 'Only the host can start';
      if (room.phase !== 'lobby') return 'Already started';
      const total = Object.values(room.settings.counts).reduce((a, b) => a + (b ?? 0), 0);
      if (total !== room.members.length) return 'Role count must match the number of players';
      const problems = setupProblems(room.settings.counts);
      if (problems.length) return problems[0]!;
      const players = room.members.map((m) => ({ id: m.id, name: m.name }));
      room.setup = { players, roles: dealRoles(players, room.settings.counts, env.random), rules: room.settings.rules };
      room.steps = [];
      room.revealed = [];
      room.predictions = [];
      room.ballots = [];
      room.killVotes = [];
      room.gameId = env.id();
      room.startedAt = env.now;
      room.winner = null;
      room.endedByHost = false;
      room.phase = 'reveal';
      room.announcement = null;
      return null;
    }

    case 'seenRole': {
      if (room.phase !== 'reveal') return null;
      if (!room.revealed.includes(playerId)) room.revealed.push(playerId);
      if (room.members.filter(isActive).every((m) => room.revealed.includes(m.id))) startNight(room, env);
      return null;
    }

    case 'ready': {
      const night = room.night;
      if (room.phase !== 'night' || !night || night.stage !== 'ready') return null;
      if (!night.ready.includes(playerId)) night.ready.push(playerId);
      if (livingActive(room, state!).every((id) => night.ready.includes(id))) wakeCurrent(room, env);
      return null;
    }

    case 'pick': {
      const night = room.night;
      const card = night?.cards[playerId]?.[cmd.card];
      if (room.phase !== 'night' || !night || !card || night.stage === 'pause' || night.stage === 'sleep') return 'Not now';
      if (cmd.target && !state!.alive[cmd.target]) return 'Pick a living player';
      if (card.kind === 'action' && card.key && cmd.target) {
        const problem = actionProblem(room, state!, card.key, cmd.target);
        if (problem) return problem;
      }
      if (card.target !== undefined && card.key !== 'mafia') return 'Already chosen';
      card.target = cmd.target;
      if (card.kind === 'action' && card.key === 'mafia') night.mafiaVotes[playerId] = cmd.target;
      afterAnswer(room, env);
      return null;
    }

    case 'done': {
      const night = room.night;
      if (!night || room.settings.nightStyle !== 'narrated' || night.stage !== 'awake') return null;
      if (night.cards[playerId]?.some((c) => c.target === undefined)) return 'Make your choice first';
      if (!night.done.includes(playerId)) night.done.push(playerId);
      afterAnswer(room, env);
      return null;
    }

    case 'chat': {
      const night = room.night;
      const role = room.setup?.roles[playerId];
      if (!night || room.settings.nightStyle !== 'narrated' || !role || teamOf(role) !== 'mafia') return 'Chat is only for the Mafia in a narrated night';
      const entry = night.queue[night.current];
      if (night.stage !== 'awake' || entry?.key !== 'mafia') return 'Not now';
      night.chat.push({ from: playerId, text: cmd.text.slice(0, 140) });
      return null;
    }

    case 'vote': {
      const day = room.day;
      if (room.phase !== 'day' || !day || (day.stage !== 'vote' && day.stage !== 'runoff')) return 'Voting is closed';
      const ds = dayState(room);
      if (cmd.target !== 'skip' && !ds.alive[cmd.target]) return 'Pick a living player';
      if (day.stage === 'runoff' && cmd.target !== 'skip' && !day.candidates.includes(cmd.target)) return 'Pick one of the two';
      if (ds.alive[playerId]) {
        if (!eligibleVoters(room, ds).includes(playerId)) return "You can't vote today";
        day.votes[playerId] = cmd.target;
      } else {
        const info = voteInfo(room.setup!, ds, rulesOf(room.setup!));
        if (!info.ghostsAvailable.includes(playerId) || day.ghostsUsed.includes(playerId) || cmd.target === 'skip') return 'No vote left';
        day.ghostVotes[playerId] = cmd.target;
      }
      afterVote(room, env);
      return null;
    }

    case 'revealMayor': {
      const day = room.day;
      if (!day || !['discussion', 'vote', 'runoff'].includes(day.stage)) return 'Not now';
      if (room.setup?.roles[playerId] !== 'mayor' || !state?.alive[playerId] || state.mayorRevealed || day.mayorRevealed) return null;
      day.mayorRevealed = true;
      announce(room, 'mayor', `${member.name} revealed their role`, [{ name: member.name, role: 'mayor' }]);
      return null;
    }

    case 'admin':
      if (!isHost) return 'Only the host can do that';
      return admin(room, cmd.action, env);
  }
}

function actionProblem(room: Room, state: State, key: PromptKey, target: PlayerId) {
  const rules = rulesOf(room.setup!);
  const setup = room.setup!;
  if (key === 'mafia' || key === 'roleblocker') {
    const role = setup.roles[target]!;
    if (teamOf(role) === 'mafia') return "That's a teammate";
  }
  const problems = nightPrompts(setup, state, room.night!.number, rules).find((p) => p.key === key)?.disabled;
  if (problems) return problems;
  return null;
}

function admin(room: Room, action: AdminAction, env: Env): string | null {
  const state = gameState(room);
  switch (action.kind) {
    case 'kick':
      if (room.phase !== 'lobby') return admin(room, { kind: 'remove', player: action.player }, env);
      room.members = room.members.filter((m) => m.id !== action.player);
      syncCounts(room);
      return null;

    case 'remove': {
      if (!state || !room.setup) return null;
      const target = room.members.find((m) => m.id === action.player);
      if (!target) return null;
      const hypothetical = structuredClone(state);
      hypothetical.alive[action.player] = false;
      const winner = winnerOf(room.setup, hypothetical, rulesOf(room.setup));
      if (winner && !action.confirm) {
        room.confirmRemove = { player: action.player, winner };
        return null;
      }
      room.confirmRemove = null;
      target.absent = true;
      room.pendingAdjust[action.player] = false;
      if (winner) {
        if (room.phase === 'night') room.steps.push({ kind: 'night', actions: {}, adjust: room.pendingAdjust });
        else room.steps.push({ kind: 'day', eliminated: [], adjust: room.pendingAdjust });
        room.pendingAdjust = {};
        endGame(room, winner);
        return null;
      }
      afterPresenceChange(room, env);
      return null;
    }

    case 'cancelRemove':
      room.confirmRemove = null;
      return null;

    case 'rejoinCode': {
      const code = env.id().replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase();
      for (const [existing, id] of Object.entries(room.rejoinCodes)) if (id === action.player) delete room.rejoinCodes[existing];
      room.rejoinCodes[code] = action.player;
      return null;
    }

    case 'transferHost': {
      const next = room.members.find((m) => m.id === action.player);
      if (!next) return null;
      room.hostId = next.id;
      room.hostLostAt = next.connected ? null : env.now;
      announce(room, 'host', `${next.name} is now the host`);
      return null;
    }

    case 'pause':
      if (room.deadline && room.pausedRemaining === null) {
        room.pausedRemaining = Math.max(0, room.deadline - env.now);
        room.deadline = null;
      }
      return null;

    case 'resume':
      if (room.pausedRemaining !== null) {
        room.deadline = env.now + room.pausedRemaining;
        room.pausedRemaining = null;
      }
      return null;

    case 'extend':
      if (room.deadline) room.deadline += 30_000;
      else if (room.pausedRemaining !== null) room.pausedRemaining += 30_000;
      return null;

    case 'skip':
      skipWaiting(room, env);
      return null;

    case 'hostPick':
      if (room.day?.stage === 'hostPick') finishDay(room, action.player ? [action.player] : [], env);
      return null;

    case 'continue':
      if (room.phase === 'day' && room.day?.stage === 'result') startNight(room, env);
      else if (room.phase === 'day' && room.day?.stage === 'discussion') openVote(room);
      return null;

    case 'end':
      room.endedByHost = true;
      endGame(room, 'draw');
      return null;

    case 'rematch':
      room.phase = 'lobby';
      room.setup = null;
      room.steps = [];
      room.night = null;
      room.day = null;
      room.winner = null;
      room.announcement = null;
      room.deadline = null;
      room.members = room.members.filter((m) => !m.absent);
      for (const m of room.members) m.absent = false;
      syncCounts(room);
      return null;
  }
}

/** Host "skip waiting": treat everyone who hasn't answered as no action / abstain. */
function skipWaiting(room: Room, env: Env) {
  if (room.phase === 'reveal') return startNight(room, env);
  if (room.phase === 'night' && room.night) {
    const night = room.night;
    if (night.stage === 'ready') return wakeCurrent(room, env);
    if (room.settings.nightStyle === 'quick') {
      for (const cards of Object.values(night.cards)) for (const c of cards) c.target ??= null;
      return finishNight(room, env);
    }
    if (night.stage === 'awake') {
      for (const cards of Object.values(night.cards)) for (const c of cards) c.target ??= null;
      return sleepCurrent(room, env);
    }
    return tick(room, { ...env, now: Infinity });
  }
  if (room.phase === 'day' && room.day) {
    if (room.day.stage === 'discussion') return openVote(room);
    if (room.day.stage === 'vote' || room.day.stage === 'runoff') return closeVote(room, env);
  }
}

function afterPresenceChange(room: Room, env: Env) {
  if (room.phase === 'reveal' && room.members.filter(isActive).every((m) => room.revealed.includes(m.id))) startNight(room, env);
  else if (room.phase === 'night' && room.night) {
    const state = gameState(room)!;
    if (room.night.stage === 'ready' && livingActive(room, state).every((id) => room.night!.ready.includes(id))) wakeCurrent(room, env);
    else if (room.night.stage === 'awake') afterAnswer(room, env);
  } else if (room.phase === 'day' && room.day && (room.day.stage === 'vote' || room.day.stage === 'runoff')) afterVote(room, env);
}

/* ---------- timers ---------- */

export function nextAlarm(room: Room): number | null {
  const times = [room.deadline];
  // Handing the host over needs someone connected to take it; when everyone has left, a reconnect does it instead.
  if (room.hostId && room.hostLostAt !== null && room.members.some((m) => m.connected && !m.absent && m.id !== room.hostId)) {
    times.push(room.hostLostAt + HOST_GRACE_MS);
  }
  if (room.phase !== 'lobby' && room.phase !== 'over') {
    for (const m of room.members) if (!m.connected && !m.absent) times.push(m.lastSeen + ABSENT_AFTER_MS);
  }
  const valid = times.filter((t): t is number => t !== null);
  return valid.length ? Math.min(...valid) : null;
}

export function tick(room: Room, env: Env) {
  if (room.hostId && room.hostLostAt !== null && env.now >= room.hostLostAt + HOST_GRACE_MS) {
    const order = room.members;
    const start = order.findIndex((m) => m.id === room.hostId);
    const next = [...order.slice(start + 1), ...order.slice(0, start)].find((m) => m.connected && !m.absent);
    if (next) {
      room.hostId = next.id;
      room.hostLostAt = null;
      announce(room, 'host', `${next.name} is now the host`);
    }
  }

  if (room.phase !== 'lobby' && room.phase !== 'over') {
    let changed = false;
    for (const m of room.members) {
      if (!m.connected && !m.absent && env.now >= m.lastSeen + ABSENT_AFTER_MS) {
        m.absent = true;
        changed = true;
      }
    }
    if (changed) afterPresenceChange(room, env);
  }

  if (room.deadline === null || env.now < room.deadline) return;
  room.deadline = null;

  if (room.phase === 'night' && room.night) {
    const night = room.night;
    if (room.settings.nightStyle === 'quick') return finishNight(room, env);
    if (night.stage === 'awake') return sleepCurrent(room, env);
    if (night.stage === 'sleep') {
      night.current += 1;
      return wakeCurrent(room, env);
    }
  }
  if (room.phase === 'day' && room.day) {
    if (room.day.stage === 'discussion') return openVote(room);
    if (room.day.stage === 'result') return startNight(room, env);
  }
}

/* ---------- views ---------- */

export interface PlayerSummary {
  id: PlayerId;
  name: string;
  alive: boolean;
  connected: boolean;
  absent: boolean;
  isHost: boolean;
  /** Public role info per the death-reveal rule (or everything once the game is over). */
  shownRole?: RoleId;
  shownTeam?: string;
}

export interface CardView extends NightCard {
  index: number;
  options: { id: PlayerId; name: string; disabled?: string }[];
  result?: 'mafia' | 'innocent';
}

export interface RoomView {
  code: string;
  phase: Room['phase'];
  you: {
    id: PlayerId;
    name: string;
    isHost: boolean;
    alive: boolean;
    role?: RoleId;
    teammates: { id: PlayerId; name: string; role: RoleId }[];
    seenRole: boolean;
    canVote: boolean;
    ghostVote: boolean;
    myVote?: PlayerId | 'skip';
    isMayor: boolean;
  } | null;
  players: PlayerSummary[];
  hostName: string | null;
  settings: RoomSettings;
  balance: ReturnType<typeof balance> | null;
  night: {
    number: number;
    style: NightStyle;
    stage: NightProgress['stage'];
    calling: PromptKey | null;
    awake: boolean;
    cards: CardView[];
    mafiaVotes: { voter: string; target: string | null }[];
    chat: { from: string; text: string }[];
    readyCount: number;
    needReady: boolean;
    youDone: boolean;
  } | null;
  day: {
    number: number;
    stage: DayProgress['stage'];
    candidates: PlayerId[];
    votesCast: number;
    voters: number;
    needed: number | null;
    totalVotes: number;
    blockedPartner: string | null;
    tally: { name: string; votes: number }[];
    /** Who voted for whom, revealed together once a round closes. */
    ballots: { voter: string; target: string | null; ghost?: boolean }[];
    mayorRevealed: boolean;
  } | null;
  deadline: number | null;
  paused: boolean;
  announcement: Announcement | null;
  cue: Room['cue'];
  winner: Winner | null;
  endedByHost: boolean;
  stats: { oracle: string | null; mostSuspected: string | null; pokerFace: string | null } | null;
  host: {
    confirmRemove: { name: string; player: PlayerId; winner: Winner } | null;
    absent: { id: PlayerId; name: string }[];
    rejoinCodes: { code: string; name: string }[];
  } | null;
  tvConnected: boolean;
}

export function viewFor(room: Room, viewer: PlayerId | 'tv'): RoomView {
  const setup = room.setup;
  const state = gameState(room);
  const rules = setup ? rulesOf(setup) : null;
  const over = room.phase === 'over';
  const me = viewer === 'tv' ? undefined : room.members.find((m) => m.id === viewer);
  const myRole = me && setup ? setup.roles[me.id] : undefined;
  const dayState_ = room.phase === 'day' ? dayState(room) : state;

  const players: PlayerSummary[] = room.members.map((m) => {
    const alive = state ? !!state.alive[m.id] : true;
    const role = setup?.roles[m.id];
    let shownRole: RoleId | undefined;
    let shownTeam: string | undefined;
    if (role && (over || (!alive && rules?.deathReveal === 'full'))) shownRole = role;
    else if (role && !alive && rules?.deathReveal === 'team') shownTeam = teamOf(role);
    return { id: m.id, name: m.name, alive, connected: m.connected, absent: m.absent, isHost: room.hostId === m.id, shownRole, shownTeam };
  });

  let you: RoomView['you'] = null;
  if (me) {
    const alive = state ? !!state.alive[me.id] : true;
    const info = setup && dayState_ ? voteInfo(setup, dayState_, rules!) : null;
    const teammates =
      myRole && teamOf(myRole) === 'mafia' && setup
        ? room.members
            .filter((m) => m.id !== me.id && teamOf(setup.roles[m.id]!) === 'mafia')
            .map((m) => ({ id: m.id, name: m.name, role: setup.roles[m.id]! }))
        : [];
    you = {
      id: me.id,
      name: me.name,
      isHost: room.hostId === me.id,
      alive,
      role: myRole,
      teammates,
      seenRole: room.revealed.includes(me.id),
      canVote: !!info && info.voters.includes(me.id),
      ghostVote: !!info && info.ghostsAvailable.includes(me.id) && !room.day?.ghostVotes[me.id] && !room.day?.ghostsUsed.includes(me.id),
      myVote: room.day?.votes[me.id] ?? room.day?.ghostVotes[me.id],
      isMayor: myRole === 'mayor',
    };
  }

  let night: RoomView['night'] = null;
  if (room.night && setup && state) {
    const n = room.night;
    const entry = n.queue[n.current];
    const calling = room.settings.nightStyle === 'narrated' && n.stage !== 'ready' ? entry?.key ?? null : null;
    const awake =
      !!me && (room.settings.nightStyle === 'quick' || (n.stage === 'awake' && !!entry && holdersOf(setup, entry.key).includes(me.id) && !!state.alive[me.id]));
    const living = room.members.filter((m) => state.alive[m.id]);
      const cards: CardView[] = awake && me
      ? (n.cards[me.id] ?? []).map((card, index) => ({
            ...card,
            index,
            options: living.map((m) => ({
              id: m.id,
              name: m.name,
              disabled:
                card.kind === 'action' && card.key
                  ? cardProblem(room, state, card.key, m.id) ?? undefined
                  : m.id === me.id ? 'You' : undefined,
            })),
          result: card.kind === 'action' && card.key === 'detective' && card.target ? detectiveResult(setup, card.target, rules!) : undefined,
        }))
      : [];
    const showMafia = !!myRole && teamOf(myRole) === 'mafia' && awake;
    night = {
      number: n.number,
      style: room.settings.nightStyle,
      stage: n.stage,
      calling,
      awake,
      cards: room.settings.nightStyle === 'narrated' && entry ? cards.filter((c) => c.key === entry.key) : cards,
      mafiaVotes: showMafia
        ? Object.entries(n.mafiaVotes).map(([voter, target]) => ({ voter: memberName(room, voter), target: target ? memberName(room, target) : null }))
        : [],
      chat: showMafia && room.settings.nightStyle === 'narrated' ? n.chat.map((c) => ({ from: memberName(room, c.from), text: c.text })) : [],
      readyCount: n.ready.length,
      needReady: n.stage === 'ready' && !!me && !n.ready.includes(me.id) && !!state.alive[me.id],
      youDone: !!me && n.done.includes(me.id),
    };
  }

  let day: RoomView['day'] = null;
  if (room.day && setup && dayState_) {
    const info = voteInfo(setup, dayState_, rules!);
    day = {
      number: room.day.number,
      stage: room.day.stage,
      candidates: room.day.candidates,
      votesCast: eligibleVoters(room, dayState_).filter((id) => room.day!.votes[id] !== undefined).length,
      voters: eligibleVoters(room, dayState_).length,
      needed: info.needed,
      totalVotes: info.votes,
      blockedPartner: info.blockedPartner ? memberName(room, info.blockedPartner) : null,
      tally: room.day.stage === 'result' || room.day.stage === 'runoff' || room.day.stage === 'hostPick'
        ? room.day.tally.map((t) => ({ name: memberName(room, t.player), votes: t.votes }))
        : [],
      ballots: room.day.stage === 'vote' || room.day.stage === 'discussion' ? [] : room.day.lastBallots,
      mayorRevealed: dayState_.mayorRevealed,
    };
  }

  const host = me && room.hostId === me.id
    ? {
        confirmRemove: room.confirmRemove
          ? { ...room.confirmRemove, name: memberName(room, room.confirmRemove.player) }
          : null,
        absent: room.members.filter((m) => m.absent && (!state || state.alive[m.id])).map((m) => ({ id: m.id, name: m.name })),
        rejoinCodes: Object.entries(room.rejoinCodes).map(([code, id]) => ({ code, name: memberName(room, id) })),
      }
    : null;

  return {
    code: room.code,
    phase: room.phase,
    you,
    players,
    hostName: room.hostId ? memberName(room, room.hostId) : null,
    settings: room.settings,
    balance: room.phase === 'lobby' ? balance(room.settings.counts, room.settings.rules) : null,
    night,
    day,
    // Night timers can reveal which roles are dead (fake calls), so phones and the TV never see them.
    deadline: room.phase === 'night' ? null : room.deadline,
    paused: room.phase === 'night' ? false : room.pausedRemaining !== null,
    announcement: room.announcement,
    cue: room.cue,
    winner: room.winner,
    endedByHost: room.endedByHost,
    stats: over ? stats(room) : null,
    host,
    tvConnected: room.tvConnected,
  };
}

function cardProblem(room: Room, state: State, key: PromptKey, target: PlayerId): string | null {
  const setup = room.setup!;
  if (key === 'mafia') return teamOf(setup.roles[target]!) === 'mafia' ? 'Mafia' : null;
  const rules = rulesOf(setup);
  // Reuse the tracker's validation so online and Mode 1 behave the same.
  return targetProblem(setup, state, key, target, rules);
}


function stats(room: Room): RoomView['stats'] {
  const setup = room.setup;
  if (!setup) return null;
  const correct = new Map<PlayerId, number>();
  const suspected = new Map<PlayerId, number>();
  const final = gameState(room)!;
  for (const p of room.predictions) {
    const role = setup.roles[p.target]!;
    let right = false;
    if (p.kind === 'predictRole') {
      right = role === p.role;
      if (p.role && teamOf(p.role) === 'mafia') suspected.set(p.target, (suspected.get(p.target) ?? 0) + 1);
    } else {
      const death = final.deaths.find((d) => d.player === p.target);
      right = !!death && room.steps[death.step]?.kind === 'night' && phaseOf(death.step).number === p.night;
    }
    if (right) correct.set(p.by, (correct.get(p.by) ?? 0) + 1);
  }
  const best = (m: Map<PlayerId, number>) => {
    const top = [...m].sort((a, b) => b[1] - a[1])[0];
    return top ? memberName(room, top[0]) : null;
  };
  const mafia = room.members.filter((m) => teamOf(setup.roles[m.id]!) === 'mafia');
  const poker = mafia.sort((a, b) => (suspected.get(a.id) ?? 0) - (suspected.get(b.id) ?? 0))[0];
  return { oracle: best(correct), mostSuspected: best(suspected), pokerFace: poker?.name ?? null };
}
