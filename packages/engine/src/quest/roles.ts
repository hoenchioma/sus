export type Side = 'good' | 'evil';

export type QuestRole = 'merlin' | 'percival' | 'servant' | 'assassin' | 'morgana' | 'mordred' | 'oberon' | 'minion';

export const QUEST_ROLES: Record<QuestRole, { side: Side; power: boolean }> = {
  merlin: { side: 'good', power: true },
  percival: { side: 'good', power: true },
  servant: { side: 'good', power: false },
  assassin: { side: 'evil', power: true },
  morgana: { side: 'evil', power: true },
  mordred: { side: 'evil', power: true },
  oberon: { side: 'evil', power: true },
  minion: { side: 'evil', power: false },
};

export const sideOf = (role: QuestRole): Side => QUEST_ROLES[role].side;

/** Optional powers the host can switch on; Merlin and the Assassin are always in play. */
export type OptionalPower = 'percival' | 'morgana' | 'mordred' | 'oberon';
export const OPTIONAL_POWERS: OptionalPower[] = ['percival', 'morgana', 'mordred', 'oberon'];
