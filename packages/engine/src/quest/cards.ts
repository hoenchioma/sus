import type { PlayerId } from './game';
import type { QuestRole } from './roles';

export type QuestSkinId = 'polashi' | 'avalon';

const POWER_FACES: Partial<Record<QuestRole, string>> = {
  merlin: 'mirMadan',
  percival: 'mohonLal',
  assassin: 'mirJafar',
  morgana: 'ghoseti',
  mordred: 'rayDurlov',
  oberon: 'umichad',
};

const shuffle = <T,>(items: T[], random: () => number) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/**
 * Polashi has a named card for every seat. Characters whose power is off are dealt as plain cards;
 * the extra 11–15 player characters only appear once the original ten run out.
 */
function polashiFaces(roles: Record<PlayerId, QuestRole>, random: () => number): Record<PlayerId, string> {
  const inPlay = new Set(Object.values(roles));
  const unused = (role: QuestRole) => (inPlay.has(role) ? [] : [POWER_FACES[role]!]);
  const goodPool = [
    ...shuffle(['siraj', 'lutfunnesa', 'deBusi', 'saintFrey', ...unused('percival')], random),
    ...shuffle(['bahadurAliKhan', 'aminaBegum', 'raniBhabani', 'jeanLaw'], random),
  ];
  const evilPool = [
    ...shuffle([...unused('morgana'), ...unused('mordred'), ...unused('oberon')], random),
    ...shuffle(['robertClive', 'jagatSeth'], random),
  ];
  return Object.fromEntries(
    Object.entries(roles).map(([id, role]) => {
      if (POWER_FACES[role]) return [id, POWER_FACES[role]!];
      return [id, (role === 'servant' ? goodPool.shift() : evilPool.shift()) ?? role];
    }),
  );
}

export function cardFaces(skin: QuestSkinId) {
  return skin === 'polashi'
    ? polashiFaces
    : (roles: Record<PlayerId, QuestRole>) => ({ ...roles }) as Record<PlayerId, string>;
}
