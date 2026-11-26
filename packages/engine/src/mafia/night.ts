import { PROMPTS, ROLES, teamOf, type ActionKind, type PromptKey } from './roles';
import type { Rules } from './rules';
import type { DeathCause, NightActions, PlayerId, Setup, State } from './types';

export interface NightPrompt {
  key: PromptKey;
  action: ActionKind;
  /** Every player holding the role (alive or not). */
  holders: PlayerId[];
  alive: boolean;
  /** Why this prompt can't act tonight, if anything. */
  disabled: string | null;
}

export type NightEvent =
  | { type: 'blocked'; player: PlayerId; key: PromptKey }
  | { type: 'attack'; by: PromptKey; target: PlayerId; outcome: 'killed' | 'saved' | 'guarded'; savedBy?: PromptKey }
  | { type: 'guardDied'; bodyguard: PlayerId; protecting: PlayerId }
  | { type: 'heartbreak'; lover: PlayerId; partner: PlayerId }
  | { type: 'check'; target: PlayerId; result: 'mafia' | 'innocent' }
  | { type: 'partner'; partner: PlayerId };

export interface NightResult {
  deaths: { player: PlayerId; cause: DeathCause }[];
  events: NightEvent[];
}

const KILL_CAUSE: Partial<Record<PromptKey, DeathCause>> = {
  mafia: 'mafia',
  serialKiller: 'serialKiller',
  vigilante: 'vigilante',
};

export function holdersOf(setup: Setup, key: PromptKey): PlayerId[] {
  return setup.players
    .map((p) => p.id)
    .filter((id) => {
      const role = setup.roles[id];
      if (!role) return false;
      return key === 'mafia' ? teamOf(role) === 'mafia' : ROLES[role].prompt === key;
    });
}

export function nightPrompts(setup: Setup, state: State, night: number, rules: Rules): NightPrompt[] {
  return PROMPTS.flatMap(({ key, action }) => {
    const holders = holdersOf(setup, key);
    if (holders.length === 0) return [];
    const alive = holders.some((id) => state.alive[id]);
    let disabled: string | null = null;
    if (!alive) disabled = 'Dead';
    else if (action === 'kill' && night === 1 && rules.noKillNight1) disabled = 'No kills on night 1';
    else if (key === 'vigilante' && state.vigilanteUsed) disabled = 'Already used';
    return [{ key, action, holders, alive, disabled }];
  });
}

/** Returns why `target` isn't allowed for this prompt, or null if it is. */
export function targetProblem(
  setup: Setup,
  state: State,
  key: PromptKey,
  target: PlayerId,
  rules: Rules,
): string | null {
  if (!state.alive[target]) return 'Dead';
  const holders = holdersOf(setup, key);
  const self = holders.includes(target);
  const targetRole = setup.roles[target];

  switch (key) {
    case 'mafia':
    case 'roleblocker':
      return targetRole && teamOf(targetRole) === 'mafia' ? 'Mafia' : null;
    case 'serialKiller':
    case 'vigilante':
    case 'detective':
      return self ? 'Themselves' : null;
    case 'bodyguard':
      if (self) return "Can't guard themselves";
      break;
    case 'doctor':
      if (self && rules.doctorSelf === 'never') return "Can't protect themselves";
      if (self && rules.doctorSelf === 'once' && state.doctorSelfUsed) return 'Self-save used';
      break;
    case 'lover':
      if (self && !rules.loverSelf) return "Can't pick themselves";
      break;
  }

  if (rules.protectorsAlternate && state.lastTargets[key] === target) return 'Picked last night';
  return null;
}

export function resolveNight(
  setup: Setup,
  state: State,
  night: number,
  actions: NightActions,
  rules: Rules,
): NightResult {
  const events: NightEvent[] = [];
  const prompts = new Map(nightPrompts(setup, state, night, rules).map((p) => [p.key, p]));

  const chosen = (key: PromptKey): PlayerId | null => {
    const prompt = prompts.get(key);
    const target = actions[key];
    if (!prompt || prompt.disabled || !target) return null;
    return targetProblem(setup, state, key, target, rules) ? null : target;
  };
  const actor = (key: PromptKey) => holdersOf(setup, key).find((id) => state.alive[id]) ?? null;

  const blocked = chosen('roleblocker');
  const act = (key: PromptKey): PlayerId | null => {
    const target = chosen(key);
    if (!target) return null;
    // The shared Mafia kill can't be blocked; only single-holder prompts can.
    if (key !== 'mafia' && blocked && actor(key) === blocked) {
      events.push({ type: 'blocked', player: blocked, key });
      return null;
    }
    return target;
  };

  const doctorTarget = act('doctor');
  const guardTarget = act('bodyguard');
  const loverTarget = act('lover');
  const bodyguard = actor('bodyguard');
  const deaths = new Map<PlayerId, DeathCause>();

  for (const by of ['mafia', 'serialKiller', 'vigilante'] as const) {
    const target = act(by);
    if (!target) continue;
    const protectable = by !== 'serialKiller' || rules.skProtectable;

    if (protectable && guardTarget === target && bodyguard) {
      events.push({ type: 'attack', by, target, outcome: 'guarded', savedBy: 'bodyguard' });
      if (doctorTarget === bodyguard) {
        events.push({ type: 'attack', by, target: bodyguard, outcome: 'saved', savedBy: 'doctor' });
      } else {
        deaths.set(bodyguard, 'guarding');
        events.push({ type: 'guardDied', bodyguard, protecting: target });
      }
      continue;
    }

    const savedBy = !protectable ? undefined : doctorTarget === target ? 'doctor' : loverTarget === target ? 'lover' : undefined;
    if (savedBy) {
      events.push({ type: 'attack', by, target, outcome: 'saved', savedBy });
    } else {
      if (!deaths.has(target)) deaths.set(target, KILL_CAUSE[by]!);
      events.push({ type: 'attack', by, target, outcome: 'killed' });
    }
  }

  const lover = actor('lover');
  if (lover && loverTarget && loverTarget !== lover && deaths.has(lover) && !deaths.has(loverTarget)) {
    deaths.set(loverTarget, 'heartbreak');
    events.push({ type: 'heartbreak', lover, partner: loverTarget });
  }

  if (loverTarget) events.push({ type: 'partner', partner: loverTarget });

  const checked = act('detective');
  if (checked) events.push({ type: 'check', target: checked, result: detectiveResult(setup, checked, rules) });

  return { deaths: [...deaths].map(([player, cause]) => ({ player, cause })), events };
}

export function detectiveResult(setup: Setup, target: PlayerId, rules: Rules): 'mafia' | 'innocent' {
  const role = setup.roles[target];
  if (!role || teamOf(role) !== 'mafia') return 'innocent';
  if (role === 'godfather' && rules.godfatherInnocent) return 'innocent';
  return 'mafia';
}
