import type { PromptKey, RoleId } from './roles';
import type { RuleChoices } from './rules';

export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Setup {
  /** In seating order. */
  players: Player[];
  roles: Record<PlayerId, RoleId>;
  rules: RuleChoices;
}

/** `undefined` = not entered yet, `null` = no action. */
export type NightActions = Partial<Record<PromptKey, PlayerId | null>>;

/** Host overrides applied after a step: player → alive? */
export type Adjustments = Record<PlayerId, boolean>;

export interface NightStep {
  kind: 'night';
  actions: NightActions;
  /** Replaces the computed deaths when the host disagrees with the hint. */
  overrideDeaths?: PlayerId[];
  adjust?: Adjustments;
}

export interface DayStep {
  kind: 'day';
  eliminated: PlayerId[];
  mayorRevealed?: boolean;
  ghostVotes?: PlayerId[];
  adjust?: Adjustments;
}

export type Step = NightStep | DayStep;

export type DeathCause =
  | 'mafia'
  | 'serialKiller'
  | 'vigilante'
  | 'guarding'
  | 'heartbreak'
  | 'vote'
  | 'host';

export interface Death {
  player: PlayerId;
  cause: DeathCause;
  step: number;
}

export interface State {
  alive: Record<PlayerId, boolean>;
  deaths: Death[];
  /** Targets chosen last night, used by the alternate rule. */
  lastTargets: NightActions;
  doctorSelfUsed: boolean;
  vigilanteUsed: boolean;
  mayorRevealed: boolean;
  /** Last night's Lover partner: revealed in the morning and can't vote today. */
  loverPartner: PlayerId | null;
  ghostUsed: PlayerId[];
  jesterWon: boolean;
}

export type Winner = 'village' | 'mafia' | 'serialKiller' | 'jester' | 'draw';

export interface Game {
  setup: Setup;
  steps: Step[];
  cursor: number;
  ended?: Winner;
}

export interface Issue {
  step: number;
  message: string;
}
