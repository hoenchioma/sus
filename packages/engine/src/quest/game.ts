import { QUEST_ROLES, sideOf, type QuestRole, type Side } from './roles';
import { effectiveQuestRules, type QuestRuleChoices, type QuestRules } from './rules';
import { failsNeeded, tableFor, teamSize } from './tables';

export type PlayerId = string;

export interface QuestSetup {
  /** Seating order, clockwise; "left" is the next index. */
  players: { id: PlayerId; name: string }[];
  roles: Record<PlayerId, QuestRole>;
  /** Cosmetic card face per player (e.g. a named Polashi character); never affects rules. */
  cards: Record<PlayerId, string>;
  rules: QuestRuleChoices;
  firstCommander: number;
}

export type QuestStep =
  | { kind: 'propose'; team: PlayerId[] }
  | { kind: 'vote'; votes: Record<PlayerId, boolean> }
  | { kind: 'chapter'; plays: Record<PlayerId, 'success' | 'betray'> }
  | { kind: 'spy'; target: PlayerId }
  | { kind: 'guess'; target: PlayerId };

export type QuestPhase = 'propose' | 'vote' | 'chapter' | 'spy' | 'guess' | 'over';

export interface ChapterResult {
  chapter: number;
  team: PlayerId[];
  betrayals: number;
  winner: Side;
}

export interface VoteRecord {
  chapter: number;
  commander: PlayerId;
  team: PlayerId[];
  votes: Record<PlayerId, boolean>;
  approved: boolean;
}

export interface QuestState {
  phase: QuestPhase;
  chapter: number;
  commander: PlayerId;
  team: PlayerId[] | null;
  /** Rejected teams in a row within the current chapter. */
  rejections: number;
  results: ChapterResult[];
  votes: VoteRecord[];
  spy: PlayerId | null;
  pastSpies: PlayerId[];
  spyChecks: { spy: PlayerId; target: PlayerId; side: Side; afterChapter: number }[];
  guess: PlayerId | null;
  winner: Side | null;
  reason: 'chapters' | 'rejections' | 'guessed' | 'missed' | null;
}

export interface QuestGame {
  setup: QuestSetup;
  steps: QuestStep[];
  cursor: number;
  ended?: boolean;
}

export const questRulesOf = (setup: QuestSetup): QuestRules => effectiveQuestRules(setup.rules, setup.players.length);

const seat = (setup: QuestSetup, index: number) => setup.players[((index % setup.players.length) + setup.players.length) % setup.players.length]!.id;
const indexOf = (setup: QuestSetup, id: PlayerId) => setup.players.findIndex((p) => p.id === id);
const wins = (results: ChapterResult[], side: Side) => results.filter((r) => r.winner === side).length;

export function initialQuestState(setup: QuestSetup): QuestState {
  const rules = questRulesOf(setup);
  const spy = rules.lady ? seat(setup, setup.firstCommander - 1) : null;
  return {
    phase: 'propose',
    chapter: 1,
    commander: seat(setup, setup.firstCommander),
    team: null,
    rejections: 0,
    results: [],
    votes: [],
    spy,
    pastSpies: spy ? [spy] : [],
    spyChecks: [],
    guess: null,
    winner: null,
    reason: null,
  };
}

/** Returns why a step can't be applied in this state, or null when it's legal. */
export function questStepProblem(setup: QuestSetup, state: QuestState, step: QuestStep): string | null {
  const n = setup.players.length;
  const known = (id: PlayerId) => indexOf(setup, id) >= 0;
  if (state.phase === 'over') return 'The game is over';
  if (step.kind !== state.phase) return `Expected ${state.phase}, got ${step.kind}`;

  switch (step.kind) {
    case 'propose': {
      const size = teamSize(n, state.chapter);
      if (new Set(step.team).size !== step.team.length || !step.team.every(known)) return 'Invalid team';
      if (step.team.length !== size) return `The team needs ${size} players`;
      return null;
    }
    case 'vote':
      if (Object.keys(step.votes).some((id) => !known(id))) return 'Only seated players vote';
      return setup.players.every((p) => typeof step.votes[p.id] === 'boolean') ? null : 'Everyone must vote';
    case 'chapter': {
      const team = state.team ?? [];
      if (!team.every((id) => step.plays[id])) return 'Every team member must play a card';
      if (Object.keys(step.plays).some((id) => !team.includes(id))) return 'Only the team plays cards';
      for (const id of team) {
        if (step.plays[id] === 'betray' && sideOf(setup.roles[id]!) === 'good') return 'Good players can only play Success';
      }
      return null;
    }
    case 'spy':
      if (!known(step.target)) return 'Invalid player';
      if (step.target === state.spy) return "The Spy can't inspect themselves";
      if (state.pastSpies.includes(step.target)) return 'That player has already been the Spy';
      return null;
    case 'guess':
      if (!known(step.target)) return 'Invalid player';
      if (sideOf(setup.roles[step.target]!) !== 'good') return 'Pick someone from the good side';
      return null;
  }
}

/** Applies one step (assumed legal) and returns the next state. */
export function applyQuestStep(setup: QuestSetup, prev: QuestState, step: QuestStep): QuestState {
  const s = structuredClone(prev);
  const n = setup.players.length;
  const rules = questRulesOf(setup);
  const passCommander = () => {
    s.commander = seat(setup, indexOf(setup, s.commander) + 1);
  };

  switch (step.kind) {
    case 'propose':
      s.team = [...step.team];
      s.phase = 'vote';
      break;

    case 'vote': {
      const yes = Object.values(step.votes).filter(Boolean).length;
      const approved = yes > n - yes;
      s.votes.push({ chapter: s.chapter, commander: s.commander, team: s.team ?? [], votes: { ...step.votes }, approved });
      if (approved) {
        s.phase = 'chapter';
      } else {
        s.rejections += 1;
        s.team = null;
        passCommander();
        if (s.rejections >= 5) {
          s.phase = 'over';
          s.winner = 'evil';
          s.reason = 'rejections';
        } else {
          s.phase = 'propose';
        }
      }
      break;
    }

    case 'chapter': {
      const betrayals = Object.values(step.plays).filter((p) => p === 'betray').length;
      const winner: Side = betrayals >= failsNeeded(n, s.chapter) ? 'evil' : 'good';
      s.results.push({ chapter: s.chapter, team: s.team ?? [], betrayals, winner });
      s.team = null;
      s.rejections = 0;
      passCommander();
      if (wins(s.results, 'evil') >= 3) {
        s.phase = 'over';
        s.winner = 'evil';
        s.reason = 'chapters';
      } else if (wins(s.results, 'good') >= 3) {
        s.phase = 'guess';
      } else if (rules.lady && s.spy && s.chapter >= 2 && s.chapter <= 4) {
        s.phase = 'spy';
      } else {
        s.chapter += 1;
        s.phase = 'propose';
      }
      break;
    }

    case 'spy':
      s.spyChecks.push({ spy: s.spy!, target: step.target, side: sideOf(setup.roles[step.target]!), afterChapter: s.chapter });
      s.spy = step.target;
      s.pastSpies.push(step.target);
      s.chapter += 1;
      s.phase = 'propose';
      break;

    case 'guess':
      s.guess = step.target;
      s.phase = 'over';
      if (setup.roles[step.target] === 'merlin') {
        s.winner = 'evil';
        s.reason = 'guessed';
      } else {
        s.winner = 'good';
        s.reason = 'missed';
      }
      break;
  }
  return s;
}

export interface QuestReplay {
  states: QuestState[];
  /** Index of the first step that isn't legal any more (after an earlier edit), if any. */
  invalidFrom: number | null;
  problem: string | null;
}

export function replayQuest(setup: QuestSetup, steps: QuestStep[]): QuestReplay {
  const states = [initialQuestState(setup)];
  for (let i = 0; i < steps.length; i++) {
    const problem = questStepProblem(setup, states[i]!, steps[i]!);
    if (problem) return { states, invalidFrom: i, problem };
    states.push(applyQuestStep(setup, states[i]!, steps[i]!));
  }
  return { states, invalidFrom: null, problem: null };
}

export const questState = (setup: QuestSetup, steps: QuestStep[]) => replayQuest(setup, steps).states.at(-1)!;

/* ---------- dealing ---------- */

function shuffle<T>(items: T[], random: () => number) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function questDeck(players: number, chosen: QuestRuleChoices): QuestRole[] {
  const { good, evil } = tableFor(players);
  const rules = effectiveQuestRules(chosen, players);
  const goodRoles: QuestRole[] = ['merlin', ...(rules.percival ? ['percival' as const] : [])];
  const evilRoles: QuestRole[] = [
    'assassin',
    ...(rules.morgana ? ['morgana' as const] : []),
    ...(rules.mordred ? ['mordred' as const] : []),
    ...(rules.oberon ? ['oberon' as const] : []),
  ];
  while (goodRoles.length < good) goodRoles.push('servant');
  while (evilRoles.length < evil) evilRoles.push('minion');
  return [...goodRoles, ...evilRoles];
}

export function dealQuest(
  players: { id: PlayerId; name: string }[],
  chosen: QuestRuleChoices,
  random: () => number,
  cardFaces: (roles: Record<PlayerId, QuestRole>, random: () => number) => Record<PlayerId, string> = (r) => ({ ...r }),
  firstCommander?: number,
): QuestSetup {
  const deck = shuffle(questDeck(players.length, chosen), random);
  const roles = Object.fromEntries(players.map((p, i) => [p.id, deck[i]!]));
  return {
    players,
    roles,
    cards: cardFaces(roles, random),
    rules: chosen,
    firstCommander: firstCommander ?? Math.floor(random() * players.length),
  };
}

export const isGood = (setup: QuestSetup, id: PlayerId) => sideOf(setup.roles[id]!) === 'good';
export const hasPower = (role: QuestRole) => QUEST_ROLES[role].power;
