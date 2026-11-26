import type { Env, Member } from '../mafia/online';
import { questBalance, type QuestBalance } from './balance';
import { cardFaces, type QuestSkinId } from './cards';
import {
  applyQuestStep,
  dealQuest,
  questState,
  questStepProblem,
  type PlayerId,
  type QuestSetup,
  type QuestState,
  type QuestStep,
} from './game';
import { knowledgeOf } from './knowledge';
import { sideOf, type QuestRole, type Side } from './roles';
import { type QuestPresetId, type QuestRuleChoices } from './rules';
import { failsNeeded, MAX_QUEST_PLAYERS, MIN_QUEST_PLAYERS, tableFor } from './tables';

export interface QuestSettings {
  rules: QuestRuleChoices;
  preset: QuestPresetId;
  skin: QuestSkinId;
  /** Seconds for the proposal/discussion timer, or 0 for no timer. */
  discussionSeconds: number;
  /** Seat index of the first Commander when the host picks; otherwise random. */
  firstCommander: number | null;
}

export interface QuestAnnouncement {
  seq: number;
  kind: 'vote' | 'chapter' | 'spy' | 'host';
  approved?: boolean;
  votes?: { name: string; approve: boolean }[];
  yes?: number;
  no?: number;
  successes?: number;
  betrayals?: number;
  chapterWinner?: Side;
  chapter?: number;
  spy?: string;
  target?: string;
  /** Host events are keys so each phone shows them in its own language. */
  hostEvent?: 'newHost' | 'undo';
  name?: string;
}

export interface QuestRoom {
  kind: 'quest';
  code: string;
  createdAt: number;
  members: Member[];
  hostId: PlayerId | null;
  hostLostAt: number | null;
  settings: QuestSettings;
  phase: 'lobby' | 'reveal' | 'game' | 'over';
  setup: QuestSetup | null;
  steps: QuestStep[];
  revealed: PlayerId[];
  pendingVotes: Record<PlayerId, boolean>;
  pendingPlays: Record<PlayerId, 'success' | 'betray'>;
  deadline: number | null;
  pausedRemaining: number | null;
  announcement: QuestAnnouncement | null;
  cue: { seq: number; id: string } | null;
  rejoinCodes: Record<string, PlayerId>;
  tvConnected: boolean;
  endedByHost: boolean;
}

export type QuestCommand =
  | { type: 'join'; name: string }
  | { type: 'leave'; successor?: PlayerId }
  | { type: 'configure'; settings: Partial<QuestSettings> }
  | { type: 'seat'; player: PlayerId; by: -1 | 1 }
  | { type: 'start' }
  | { type: 'seenRole' }
  | { type: 'propose'; team: PlayerId[] }
  | { type: 'vote'; approve: boolean }
  | { type: 'play'; card: 'success' | 'betray' }
  | { type: 'spy'; target: PlayerId }
  | { type: 'guess'; target: PlayerId }
  | { type: 'admin'; action: QuestAdmin };

export type QuestAdmin =
  | { kind: 'kick'; player: PlayerId }
  | { kind: 'rejoinCode'; player: PlayerId }
  | { kind: 'transferHost'; player: PlayerId }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'extend' }
  | { kind: 'skip' }
  | { kind: 'undo' }
  | { kind: 'end' }
  | { kind: 'rematch' };

const HOST_GRACE_MS = 60_000;
const ABSENT_AFTER_MS = 45_000;

export function createQuestRoom(code: string, now: number, skin: QuestSkinId = 'polashi'): QuestRoom {
  return {
    kind: 'quest',
    code,
    createdAt: now,
    members: [],
    hostId: null,
    hostLostAt: null,
    settings: { rules: {}, preset: 'first', skin, discussionSeconds: 0, firstCommander: null },
    phase: 'lobby',
    setup: null,
    steps: [],
    revealed: [],
    pendingVotes: {},
    pendingPlays: {},
    deadline: null,
    pausedRemaining: null,
    announcement: null,
    cue: null,
    rejoinCodes: {},
    tvConnected: false,
    endedByHost: false,
  };
}

const nameOf = (room: QuestRoom, id: PlayerId) => room.members.find((m) => m.id === id)?.name ?? '?';
const present = (room: QuestRoom) => room.members.filter((m) => !m.absent);
const isPresent = (room: QuestRoom, id: PlayerId) => !room.members.find((m) => m.id === id)?.absent;

export const questRoomState = (room: QuestRoom): QuestState | null => (room.setup ? questState(room.setup, room.steps) : null);

function announce(room: QuestRoom, a: Omit<QuestAnnouncement, 'seq'>) {
  room.announcement = { ...a, seq: (room.announcement?.seq ?? 0) + 1 };
}

function cue(room: QuestRoom, id: string) {
  room.cue = { seq: (room.cue?.seq ?? 0) + 1, id };
}

function startTimer(room: QuestRoom, now: number) {
  room.deadline = room.settings.discussionSeconds ? now + room.settings.discussionSeconds * 1000 : null;
  room.pausedRemaining = null;
}

/* ---------- joining ---------- */

export function joinQuest(room: QuestRoom, name: string, env: Env): Member | string {
  const clean = name.trim().slice(0, 20);
  if (!clean) return 'Enter a name';
  if (room.phase !== 'lobby') return 'This game has already started';
  if (room.members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) return 'That name is taken';
  if (room.members.length >= MAX_QUEST_PLAYERS) return 'The room is full';
  const member: Member = { id: env.id(), name: clean, token: env.id(), connected: true, lastSeen: env.now, absent: false };
  room.members.push(member);
  room.hostId ??= member.id;
  return member;
}

export function useQuestRejoinCode(room: QuestRoom, code: string, env: Env): Member | null {
  const id = room.rejoinCodes[code.toUpperCase()];
  const member = room.members.find((m) => m.id === id);
  if (!member) return null;
  delete room.rejoinCodes[code.toUpperCase()];
  member.token = env.id();
  member.absent = false;
  member.connected = true;
  return member;
}

export function setQuestConnected(room: QuestRoom, playerId: PlayerId, connected: boolean, now: number) {
  const member = room.members.find((m) => m.id === playerId);
  if (!member) return;
  member.connected = connected;
  member.lastSeen = now;
  if (connected) member.absent = false;
  if (playerId === room.hostId) room.hostLostAt = connected ? null : now;
}

/* ---------- steps ---------- */

function commit(room: QuestRoom, step: QuestStep, env: Env): string | null {
  const state = questRoomState(room)!;
  const problem = questStepProblem(room.setup!, state, step);
  if (problem) return problem;
  room.steps.push(step);
  const next = applyQuestStep(room.setup!, state, step);

  if (step.kind === 'vote') {
    const last = next.votes.at(-1)!;
    const yes = Object.values(step.votes).filter(Boolean).length;
    announce(room, {
      kind: 'vote',
      approved: last.approved,
      yes,
      no: Object.keys(step.votes).length - yes,
      votes: room.setup!.rules.anonymousVotes ? undefined : room.setup!.players.map((p) => ({ name: p.name, approve: step.votes[p.id]! })),
    });
    cue(room, last.approved ? 'approved' : 'rejected');
  } else if (step.kind === 'chapter') {
    const result = next.results.at(-1)!;
    announce(room, {
      kind: 'chapter',
      chapter: result.chapter,
      successes: result.team.length - result.betrayals,
      betrayals: result.betrayals,
      chapterWinner: result.winner,
    });
    cue(room, result.winner === 'good' ? 'chapterWon' : 'chapterLost');
  } else if (step.kind === 'spy') {
    announce(room, { kind: 'spy', spy: nameOf(room, state.spy!), target: nameOf(room, step.target) });
    cue(room, 'spy');
  }

  room.pendingVotes = {};
  room.pendingPlays = {};
  if (next.phase === 'over') {
    room.phase = 'over';
    room.deadline = null;
    cue(room, next.winner === 'good' ? 'goodWins' : 'evilWins');
  } else {
    if (next.phase === 'guess') cue(room, 'lastChance');
    if (next.phase === 'propose' && step.kind !== 'propose') cue(room, 'newCommander');
    if (next.phase === 'vote') cue(room, 'vote');
    startTimer(room, env.now);
  }
  return null;
}

function tryFinishVote(room: QuestRoom, env: Env, force = false) {
  const players = room.setup!.players;
  const waiting = players.filter((p) => room.pendingVotes[p.id] === undefined && isPresent(room, p.id));
  if (waiting.length && !force) return;
  // Anyone who is away (or hasn't voted when the host skips) counts as approving.
  const votes = Object.fromEntries(players.map((p) => [p.id, room.pendingVotes[p.id] ?? true]));
  commit(room, { kind: 'vote', votes }, env);
}

function tryFinishChapter(room: QuestRoom, env: Env, force = false) {
  const team = questRoomState(room)!.team ?? [];
  const waiting = team.filter((id) => room.pendingPlays[id] === undefined && isPresent(room, id));
  if (waiting.length && !force) return;
  const plays = Object.fromEntries(team.map((id) => [id, room.pendingPlays[id] ?? ('success' as const)]));
  commit(room, { kind: 'chapter', plays }, env);
}

/* ---------- commands ---------- */

export function applyQuest(room: QuestRoom, playerId: PlayerId, cmd: QuestCommand, env: Env): string | null {
  const member = room.members.find((m) => m.id === playerId);
  if (!member) return 'Unknown player';
  member.lastSeen = env.now;
  const isHost = room.hostId === playerId;
  const state = questRoomState(room);

  switch (cmd.type) {
    case 'join':
      return 'Already joined';

    case 'leave': {
      if (room.phase === 'lobby') room.members = room.members.filter((m) => m.id !== playerId);
      else {
        member.absent = true;
        member.connected = false;
      }
      if (isHost) {
        const next = room.members.find((m) => m.id === cmd.successor && !m.absent) ?? room.members.find((m) => m.connected && !m.absent && m.id !== playerId);
        room.hostId = next?.id ?? null;
        room.hostLostAt = null;
        if (next) announce(room, { kind: 'host', hostEvent: 'newHost', name: next.name });
      }
      afterPresenceChange(room, env);
      return null;
    }

    case 'configure':
      if (!isHost) return 'Only the host can change settings';
      if (room.phase !== 'lobby') return 'The game has started';
      room.settings = { ...room.settings, ...cmd.settings };
      return null;

    case 'seat': {
      if (!isHost || room.phase !== 'lobby') return 'Only the host can change seats in the lobby';
      const i = room.members.findIndex((m) => m.id === cmd.player);
      const j = i + cmd.by;
      if (i < 0 || j < 0 || j >= room.members.length) return null;
      [room.members[i], room.members[j]] = [room.members[j]!, room.members[i]!];
      return null;
    }

    case 'start': {
      if (!isHost) return 'Only the host can start';
      if (room.phase !== 'lobby') return 'Already started';
      const n = room.members.length;
      if (n < MIN_QUEST_PLAYERS) return `Needs at least ${MIN_QUEST_PLAYERS} players`;
      tableFor(n);
      const players = room.members.map((m) => ({ id: m.id, name: m.name }));
      const first = room.settings.firstCommander !== null && room.settings.firstCommander < n ? room.settings.firstCommander : undefined;
      room.setup = dealQuest(players, room.settings.rules, env.random, cardFaces(room.settings.skin), first);
      room.steps = [];
      room.revealed = [];
      room.pendingVotes = {};
      room.pendingPlays = {};
      room.endedByHost = false;
      room.announcement = null;
      room.phase = 'reveal';
      return null;
    }

    case 'seenRole':
      if (room.phase !== 'reveal') return null;
      if (!room.revealed.includes(playerId)) room.revealed.push(playerId);
      afterPresenceChange(room, env);
      return null;

    case 'propose':
      if (room.phase !== 'game' || state?.phase !== 'propose') return 'Not now';
      if (state.commander !== playerId) return 'Only the Commander proposes the team';
      return commit(room, { kind: 'propose', team: cmd.team }, env);

    case 'vote':
      if (room.phase !== 'game' || state?.phase !== 'vote') return 'Not now';
      room.pendingVotes[playerId] = cmd.approve;
      tryFinishVote(room, env);
      return null;

    case 'play': {
      if (room.phase !== 'game' || state?.phase !== 'chapter') return 'Not now';
      if (!state.team?.includes(playerId)) return "You're not on this team";
      if (cmd.card === 'betray' && sideOf(room.setup!.roles[playerId]!) === 'good') return 'You can only play Success';
      room.pendingPlays[playerId] = cmd.card;
      tryFinishChapter(room, env);
      return null;
    }

    case 'spy':
      if (room.phase !== 'game' || state?.phase !== 'spy') return 'Not now';
      if (state.spy !== playerId) return 'Only the Spy can inspect';
      return commit(room, { kind: 'spy', target: cmd.target }, env);

    case 'guess': {
      if (room.phase !== 'game' || state?.phase !== 'guess') return 'Not now';
      const role = room.setup!.roles[playerId]!;
      const assassin = room.members.find((m) => room.setup!.roles[m.id] === 'assassin');
      const assassinAway = !assassin || assassin.absent;
      if (role !== 'assassin' && !(assassinAway && sideOf(role) === 'evil')) return 'Only the Assassin makes the final guess';
      return commit(room, { kind: 'guess', target: cmd.target }, env);
    }

    case 'admin':
      if (!isHost) return 'Only the host can do that';
      return admin(room, cmd.action, env);
  }
}

function admin(room: QuestRoom, action: QuestAdmin, env: Env): string | null {
  const state = questRoomState(room);
  switch (action.kind) {
    case 'kick':
      if (room.phase === 'lobby') room.members = room.members.filter((m) => m.id !== action.player);
      else {
        const m = room.members.find((x) => x.id === action.player);
        if (m) m.absent = true;
        afterPresenceChange(room, env);
      }
      return null;
    case 'rejoinCode': {
      for (const [code, id] of Object.entries(room.rejoinCodes)) if (id === action.player) delete room.rejoinCodes[code];
      room.rejoinCodes[env.id().replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase()] = action.player;
      return null;
    }
    case 'transferHost': {
      const next = room.members.find((m) => m.id === action.player);
      if (!next) return null;
      room.hostId = next.id;
      room.hostLostAt = next.connected ? null : env.now;
      announce(room, { kind: 'host', hostEvent: 'newHost', name: next.name });
      return null;
    }
    case 'pause':
      if (room.deadline) {
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
      return null;
    case 'skip':
      if (room.phase === 'reveal') return startGame(room, env);
      if (!state || room.phase !== 'game') return null;
      if (state.phase === 'vote') tryFinishVote(room, env, true);
      else if (state.phase === 'chapter') tryFinishChapter(room, env, true);
      else if (state.phase === 'propose') {
        // The Commander is stuck or away: the app proposes a random team for them.
        const size = tableFor(room.setup!.players.length).teams[state.chapter - 1]!;
        const team = shuffleIds(room.setup!.players.map((p) => p.id), env.random).slice(0, size);
        commit(room, { kind: 'propose', team }, env);
      } else if (state.phase === 'spy') {
        const options = room.setup!.players.map((p) => p.id).filter((id) => !state.pastSpies.includes(id));
        if (options.length) commit(room, { kind: 'spy', target: options[Math.floor(env.random() * options.length)]! }, env);
      }
      return null;
    case 'undo': {
      // Only a public step can be undone, and only the last one.
      const last = room.steps.at(-1);
      if (!last || last.kind === 'chapter' || last.kind === 'spy' || last.kind === 'guess') return 'Nothing public to undo';
      room.steps.pop();
      room.pendingVotes = {};
      if (room.phase === 'over') room.phase = 'game';
      announce(room, { kind: 'host', hostEvent: 'undo' });
      return null;
    }
    case 'end':
      room.endedByHost = true;
      room.phase = 'over';
      room.deadline = null;
      return null;
    case 'rematch':
      room.phase = 'lobby';
      room.setup = null;
      room.steps = [];
      room.announcement = null;
      room.deadline = null;
      room.members = room.members.filter((m) => !m.absent);
      return null;
  }
}

function shuffleIds(ids: PlayerId[], random: () => number) {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function startGame(room: QuestRoom, env: Env) {
  room.phase = 'game';
  cue(room, 'newCommander');
  startTimer(room, env.now);
  return null;
}

function afterPresenceChange(room: QuestRoom, env: Env) {
  if (room.phase === 'reveal' && present(room).every((m) => room.revealed.includes(m.id))) startGame(room, env);
  if (room.phase !== 'game') return;
  const state = questRoomState(room)!;
  if (state.phase === 'vote') tryFinishVote(room, env);
  if (state.phase === 'chapter') tryFinishChapter(room, env);
}

/* ---------- timers ---------- */

export function questNextAlarm(room: QuestRoom): number | null {
  const times: number[] = [];
  if (room.hostId && room.hostLostAt !== null) times.push(room.hostLostAt + HOST_GRACE_MS);
  if (room.phase === 'reveal' || room.phase === 'game') {
    for (const m of room.members) if (!m.connected && !m.absent) times.push(m.lastSeen + ABSENT_AFTER_MS);
  }
  return times.length ? Math.min(...times) : null;
}

export function tickQuest(room: QuestRoom, env: Env) {
  if (room.hostId && room.hostLostAt !== null && env.now >= room.hostLostAt + HOST_GRACE_MS) {
    const start = room.members.findIndex((m) => m.id === room.hostId);
    const next = [...room.members.slice(start + 1), ...room.members.slice(0, start)].find((m) => m.connected && !m.absent);
    if (next) {
      room.hostId = next.id;
      room.hostLostAt = null;
      announce(room, { kind: 'host', hostEvent: 'newHost', name: next.name });
    }
  }
  if (room.phase === 'reveal' || room.phase === 'game') {
    let changed = false;
    for (const m of room.members) {
      if (!m.connected && !m.absent && env.now >= m.lastSeen + ABSENT_AFTER_MS) {
        m.absent = true;
        changed = true;
      }
    }
    if (changed) afterPresenceChange(room, env);
  }
}

/* ---------- views ---------- */

export interface QuestRoomView {
  kind: 'quest';
  code: string;
  phase: QuestRoom['phase'];
  settings: QuestSettings;
  balance: QuestBalance | null;
  hostName: string | null;
  players: { id: PlayerId; name: string; connected: boolean; absent: boolean; isHost: boolean; role?: QuestRole; card?: string }[];
  you: {
    id: PlayerId;
    name: string;
    isHost: boolean;
    role?: QuestRole;
    card?: string;
    side?: Side;
    knows: { kind: 'none' | 'evil' | 'merlinCandidates' | 'team'; players: { name: string; card?: string; role?: QuestRole }[] };
    seenRole: boolean;
    myVote?: boolean;
    myPlay?: 'success' | 'betray';
    canGuess: boolean;
    spyResults: { target: string; side: Side }[];
  } | null;
  board: {
    chapter: number;
    teams: number[];
    doubleFail: boolean[];
    results: { winner: Side; betrayals: number }[];
    rejections: number;
    commander: PlayerId;
    team: PlayerId[] | null;
    phase: QuestState['phase'];
    spy: PlayerId | null;
    pastSpies: PlayerId[];
    votesIn: number;
    playsIn: number;
    lastVote: QuestState['votes'][number] | null;
  } | null;
  outcome: { winner: Side | null; reason: QuestState['reason']; guess: string | null; endedByHost: boolean } | null;
  deadline: number | null;
  paused: boolean;
  announcement: QuestAnnouncement | null;
  cue: QuestRoom['cue'];
  host: { absent: { id: PlayerId; name: string }[]; rejoinCodes: { code: string; name: string }[] } | null;
  tvConnected: boolean;
}

export function viewQuest(room: QuestRoom, viewer: PlayerId | 'tv'): QuestRoomView {
  const setup = room.setup;
  const state = questRoomState(room);
  const over = room.phase === 'over';
  const me = viewer === 'tv' ? undefined : room.members.find((m) => m.id === viewer);
  const n = room.members.length;
  const anonymous = !!setup?.rules.anonymousVotes;

  let you: QuestRoomView['you'] = null;
  if (me) {
    const role = setup?.roles[me.id];
    const k = setup && role ? knowledgeOf(setup, me.id) : { kind: 'none' as const };
    const evilGuessing = state?.phase === 'guess' && role && sideOf(role) === 'evil';
    const assassin = room.members.find((m) => setup?.roles[m.id] === 'assassin');
    you = {
      id: me.id,
      name: me.name,
      isHost: room.hostId === me.id,
      role,
      card: setup?.cards[me.id],
      side: role ? sideOf(role) : undefined,
      knows: {
        kind: evilGuessing ? 'team' : k.kind,
        players: (evilGuessing
          ? room.members.filter((m) => m.id !== me.id && sideOf(setup!.roles[m.id]!) === 'evil').map((m) => m.id)
          : k.kind === 'none' ? [] : k.players
        ).map((id) => ({
          name: nameOf(room, id),
          card: k.kind === 'team' || evilGuessing ? setup!.cards[id] : undefined,
          role: evilGuessing ? setup!.roles[id] : undefined,
        })),
      },
      seenRole: room.revealed.includes(me.id),
      myVote: room.pendingVotes[me.id],
      myPlay: room.pendingPlays[me.id],
      canGuess: !!evilGuessing && (role === 'assassin' || !assassin || assassin.absent),
      spyResults: (state?.spyChecks ?? []).filter((c) => c.spy === me.id).map((c) => ({ target: nameOf(room, c.target), side: c.side })),
    };
  }

  const board: QuestRoomView['board'] =
    state && setup
      ? {
          chapter: state.chapter,
          teams: tableFor(n).teams,
          doubleFail: [1, 2, 3, 4, 5].map((c) => failsNeeded(n, c) === 2),
          results: state.results.map((r) => ({ winner: r.winner, betrayals: r.betrayals })),
          rejections: state.rejections,
          commander: state.commander,
          team: state.team,
          phase: state.phase,
          spy: state.spy,
          pastSpies: state.pastSpies,
          votesIn: Object.keys(room.pendingVotes).length,
          playsIn: Object.keys(room.pendingPlays).length,
          lastVote: state.votes.at(-1)
            ? { ...state.votes.at(-1)!, votes: anonymous && !over ? {} : state.votes.at(-1)!.votes }
            : null,
        }
      : null;

  return {
    kind: 'quest',
    code: room.code,
    phase: room.phase,
    settings: room.settings,
    balance: room.phase === 'lobby' && n >= MIN_QUEST_PLAYERS ? questBalance(room.settings.rules, n) : null,
    hostName: room.hostId ? nameOf(room, room.hostId) : null,
    players: room.members.map((m) => ({
      id: m.id,
      name: m.name,
      connected: m.connected,
      absent: m.absent,
      isHost: room.hostId === m.id,
      role: over && setup ? setup.roles[m.id] : undefined,
      card: over && setup ? setup.cards[m.id] : undefined,
    })),
    you,
    board,
    outcome: over
      ? { winner: state?.winner ?? null, reason: state?.reason ?? null, guess: state?.guess ? nameOf(room, state.guess) : null, endedByHost: room.endedByHost }
      : null,
    deadline: room.deadline,
    paused: room.pausedRemaining !== null,
    announcement: room.announcement,
    cue: room.cue,
    host:
      me && room.hostId === me.id
        ? {
            absent: room.members.filter((m) => m.absent).map((m) => ({ id: m.id, name: m.name })),
            rejoinCodes: Object.entries(room.rejoinCodes).map(([code, id]) => ({ code, name: nameOf(room, id) })),
          }
        : null,
    tvConnected: room.tvConnected,
  };
}
