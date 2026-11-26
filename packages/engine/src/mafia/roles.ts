export type Team = 'village' | 'mafia' | 'neutral';

export type RoleId =
  | 'villager'
  | 'mafia'
  | 'godfather'
  | 'roleblocker'
  | 'doctor'
  | 'detective'
  | 'bodyguard'
  | 'lover'
  | 'vigilante'
  | 'mayor'
  | 'serialKiller'
  | 'jester';

/** Each night prompt the host (or the app) asks for. `mafia` is the shared team kill. */
export type PromptKey =
  | 'roleblocker'
  | 'mafia'
  | 'serialKiller'
  | 'vigilante'
  | 'bodyguard'
  | 'doctor'
  | 'lover'
  | 'detective';

export type ActionKind = 'block' | 'kill' | 'guard' | 'protect' | 'love' | 'check';

export interface RoleDef {
  id: RoleId;
  team: Team;
  points: number;
  /** Villager and Mafia can appear many times; every other role at most once. */
  unique: boolean;
  prompt?: PromptKey;
  complex?: boolean;
}

export const ROLES: Record<RoleId, RoleDef> = {
  villager: { id: 'villager', team: 'village', points: 1, unique: false },
  mafia: { id: 'mafia', team: 'mafia', points: -6, unique: false, prompt: 'mafia' },
  godfather: { id: 'godfather', team: 'mafia', points: -7, unique: true, prompt: 'mafia' },
  roleblocker: { id: 'roleblocker', team: 'mafia', points: -7, unique: true, prompt: 'roleblocker', complex: true },
  doctor: { id: 'doctor', team: 'village', points: 4, unique: true, prompt: 'doctor' },
  detective: { id: 'detective', team: 'village', points: 7, unique: true, prompt: 'detective' },
  bodyguard: { id: 'bodyguard', team: 'village', points: 3, unique: true, prompt: 'bodyguard' },
  lover: { id: 'lover', team: 'village', points: 2, unique: true, prompt: 'lover' },
  vigilante: { id: 'vigilante', team: 'village', points: 4, unique: true, prompt: 'vigilante', complex: true },
  mayor: { id: 'mayor', team: 'village', points: 2, unique: true },
  serialKiller: { id: 'serialKiller', team: 'neutral', points: 0, unique: true, prompt: 'serialKiller', complex: true },
  jester: { id: 'jester', team: 'neutral', points: 0, unique: true, complex: true },
};

export const ROLE_IDS = Object.keys(ROLES) as RoleId[];

export const PROMPTS: { key: PromptKey; action: ActionKind }[] = [
  { key: 'roleblocker', action: 'block' },
  { key: 'mafia', action: 'kill' },
  { key: 'serialKiller', action: 'kill' },
  { key: 'vigilante', action: 'kill' },
  { key: 'bodyguard', action: 'guard' },
  { key: 'doctor', action: 'protect' },
  { key: 'lover', action: 'love' },
  { key: 'detective', action: 'check' },
];

export const teamOf = (role: RoleId): Team => ROLES[role].team;
