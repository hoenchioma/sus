import { holdersOf, resolveNight, targetProblem, type NightResult } from './night';
import { PROMPTS, teamOf, type PromptKey, type RoleId } from './roles';
import { effectiveRules, type RoleCounts, type Rules } from './rules';
import type { DayStep, Game, Issue, NightStep, PlayerId, Setup, State, Step, Winner } from './types';

export const phaseOf = (index: number) => ({
  kind: index % 2 === 0 ? ('night' as const) : ('day' as const),
  number: Math.floor(index / 2) + 1,
});

export const emptyStep = (index: number): Step =>
  phaseOf(index).kind === 'night' ? { kind: 'night', actions: {} } : { kind: 'day', eliminated: [] };

export function roleCounts(setup: Setup): RoleCounts {
  const counts: RoleCounts = {};
  for (const role of Object.values(setup.roles)) counts[role] = (counts[role] ?? 0) + 1;
  return counts;
}

export const rulesOf = (setup: Setup): Rules => effectiveRules(setup.rules, roleCounts(setup));

export function initialState(setup: Setup): State {
  return {
    alive: Object.fromEntries(setup.players.map((p) => [p.id, true])),
    deaths: [],
    lastTargets: {},
    doctorSelfUsed: false,
    vigilanteUsed: false,
    mayorRevealed: false,
    loverPartner: null,
    ghostUsed: [],
    jesterWon: false,
  };
}

const playerWithRole = (setup: Setup, role: RoleId) =>
  setup.players.find((p) => setup.roles[p.id] === role)?.id ?? null;

function kill(state: State, player: PlayerId, cause: State['deaths'][number]['cause'], step: number) {
  if (!state.alive[player]) return;
  state.alive[player] = false;
  state.deaths.push({ player, cause, step });
}

function applyAdjustments(state: State, step: Step, index: number) {
  for (const [player, alive] of Object.entries(step.adjust ?? {})) {
    if (alive && !state.alive[player]) {
      state.alive[player] = true;
      state.deaths = state.deaths.filter((d) => d.player !== player);
    } else if (!alive) {
      kill(state, player, 'host', index);
    }
  }
}

function applyNight(setup: Setup, prev: State, step: NightStep, index: number, rules: Rules, issues: Issue[]) {
  const night = phaseOf(index).number;
  for (const { key } of PROMPTS) {
    const target = step.actions[key];
    if (!target) continue;
    const problem = targetProblem(setup, prev, key, target, rules);
    if (problem && holdersOf(setup, key).some((id) => prev.alive[id])) {
      issues.push({ step: index, message: `${key}: ${problem}` });
    }
  }

  const result = resolveNight(setup, prev, night, step.actions, rules);
  const state = structuredClone(prev);
  const deaths = step.overrideDeaths
    ? step.overrideDeaths.map((player) => ({
        player,
        cause: result.deaths.find((d) => d.player === player)?.cause ?? ('host' as const),
      }))
    : result.deaths;
  for (const d of deaths) kill(state, d.player, d.cause, index);

  state.lastTargets = {};
  for (const key of ['doctor', 'bodyguard', 'lover'] as PromptKey[]) {
    const target = step.actions[key];
    if (target) state.lastTargets[key] = target;
  }
  const doctor = playerWithRole(setup, 'doctor');
  if (doctor && step.actions.doctor === doctor && prev.alive[doctor]) state.doctorSelfUsed = true;
  if (step.actions.vigilante && result.events.some((e) => e.type === 'attack' && e.by === 'vigilante')) {
    state.vigilanteUsed = true;
  }
  const partner = result.events.find((e) => e.type === 'partner');
  state.loverPartner = partner?.type === 'partner' ? partner.partner : null;
  return state;
}

function applyDay(setup: Setup, prev: State, step: DayStep, index: number, rules: Rules, issues: Issue[]) {
  const state = structuredClone(prev);
  for (const player of step.eliminated) {
    if (!prev.alive[player]) {
      issues.push({ step: index, message: 'Eliminated player was already dead' });
      continue;
    }
    kill(state, player, 'vote', index);
    if (setup.roles[player] === 'jester') state.jesterWon = true;
    if (setup.roles[player] === 'lover' && rules.loverDayDeath && prev.loverPartner) {
      kill(state, prev.loverPartner, 'heartbreak', index);
    }
  }
  if (step.mayorRevealed) state.mayorRevealed = true;
  state.ghostUsed = [...state.ghostUsed, ...(step.ghostVotes ?? [])];
  state.loverPartner = null;
  return state;
}

export interface Replay {
  /** `states[i]` is the state at the start of step i; `states[steps.length]` is after the last. */
  states: State[];
  issues: Issue[];
}

export function replay(setup: Setup, steps: Step[]): Replay {
  const rules = rulesOf(setup);
  const issues: Issue[] = [];
  const states: State[] = [initialState(setup)];
  steps.forEach((step, index) => {
    const prev = states[index]!;
    let next = step.kind === 'night'
      ? applyNight(setup, prev, step, index, rules, issues)
      : applyDay(setup, prev, step, index, rules, issues);
    if (step.adjust) {
      next = structuredClone(next);
      applyAdjustments(next, step, index);
    }
    states.push(next);
  });
  return { states, issues };
}

export function previewNight(game: Game, index: number): NightResult {
  const step = game.steps[index];
  if (step?.kind !== 'night') return { deaths: [], events: [] };
  const { states } = replay(game.setup, game.steps.slice(0, index));
  return resolveNight(game.setup, states[index]!, phaseOf(index).number, step.actions, rulesOf(game.setup));
}

export function winnerOf(setup: Setup, state: State, rules: Rules): Winner | null {
  if (state.jesterWon && rules.jesterEnds) return 'jester';
  const living = setup.players.map((p) => p.id).filter((id) => state.alive[id]);
  if (living.length === 0) return 'draw';
  const roleOf = (id: PlayerId) => setup.roles[id]!;
  const killerAlive = living.some((id) => roleOf(id) === 'serialKiller');
  const mafia = living.filter((id) => teamOf(roleOf(id)) === 'mafia').length;

  if (killerAlive) return living.length === 1 ? 'serialKiller' : null;
  if (mafia === 0) return 'village';
  if (mafia >= living.length - mafia) return 'mafia';
  return null;
}

export interface VoteInfo {
  alive: number;
  /** Living players allowed to vote today. */
  voters: PlayerId[];
  /** Votes the living can cast (a revealed Mayor counts twice). */
  votes: number;
  needed: number | null;
  ghostsAvailable: PlayerId[];
  blockedPartner: PlayerId | null;
}

export function voteInfo(setup: Setup, state: State, rules: Rules): VoteInfo {
  const living = setup.players.map((p) => p.id).filter((id) => state.alive[id]);
  const blocked = state.loverPartner && state.alive[state.loverPartner] ? state.loverPartner : null;
  const voters = living.filter((id) => id !== blocked);
  const mayor = playerWithRole(setup, 'mayor');
  const votes = voters.length + (state.mayorRevealed && mayor && voters.includes(mayor) ? 1 : 0);
  const needed =
    rules.votesNeeded === 'majority' ? Math.floor(votes / 2) + 1 :
    rules.votesNeeded === 'half' ? Math.ceil(votes / 2) :
    null;
  const ghostsAvailable = rules.ghostVote
    ? setup.players.map((p) => p.id).filter((id) => !state.alive[id] && !state.ghostUsed.includes(id))
    : [];
  return { alive: living.length, voters, votes, needed, ghostsAvailable, blockedPartner: blocked };
}

export function newGame(setup: Setup): Game {
  return { setup, steps: [emptyStep(0)], cursor: 0 };
}

export function setStep(game: Game, index: number, step: Step): Game {
  const steps = [...game.steps];
  steps[index] = step;
  return { ...game, steps };
}

export function goTo(game: Game, index: number): Game {
  const cursor = Math.max(0, Math.min(index, game.steps.length));
  const steps = cursor === game.steps.length ? [...game.steps, emptyStep(cursor)] : game.steps;
  return { ...game, steps, cursor, ended: undefined };
}

export const endGame = (game: Game, winner: Winner): Game => ({ ...game, ended: winner });

export interface GameView {
  rules: Rules;
  /** State at the start of the current step. */
  state: State;
  /** State once the current step is applied. */
  after: State;
  issues: Issue[];
  winnerAfter: Winner | null;
}

export function view(game: Game): GameView {
  const rules = rulesOf(game.setup);
  const { states, issues } = replay(game.setup, game.steps);
  const after = states[game.cursor + 1]!;
  return {
    rules,
    state: states[game.cursor]!,
    after,
    issues,
    winnerAfter: winnerOf(game.setup, after, rules),
  };
}
