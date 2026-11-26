import type { PlayerId, QuestSetup } from './game';
import { sideOf, type QuestRole } from './roles';

export type Knowledge =
  | { kind: 'none' }
  /** Merlin: these players are evil (Mordred hidden). */
  | { kind: 'evil'; players: PlayerId[] }
  /** Percival: one of these is Merlin, the other (if any) is Morgana. */
  | { kind: 'merlinCandidates'; players: PlayerId[] }
  /** Evil (except Oberon): your fellow evil players (Oberon hidden). */
  | { kind: 'team'; players: PlayerId[] };

export function knowledgeOf(setup: QuestSetup, viewer: PlayerId): Knowledge {
  const role = setup.roles[viewer]!;
  const others = setup.players.map((p) => p.id).filter((id) => id !== viewer);
  const roleOf = (id: PlayerId): QuestRole => setup.roles[id]!;

  if (role === 'merlin') return { kind: 'evil', players: others.filter((id) => sideOf(roleOf(id)) === 'evil' && roleOf(id) !== 'mordred') };
  if (role === 'percival') return { kind: 'merlinCandidates', players: others.filter((id) => roleOf(id) === 'merlin' || roleOf(id) === 'morgana') };
  if (sideOf(role) === 'evil' && role !== 'oberon') {
    return { kind: 'team', players: others.filter((id) => sideOf(roleOf(id)) === 'evil' && roleOf(id) !== 'oberon') };
  }
  return { kind: 'none' };
}

/** Lines for the eyes-closed ritual (Mode 1), dropping lines for powers not in play. Keys are translated by the skin. */
export function ritualScript(setup: QuestSetup): string[] {
  const inPlay = new Set(Object.values(setup.roles));
  const lines = ['closeEyes', inPlay.has('oberon') ? 'evilOpenNotOberon' : 'evilOpen', 'evilClose'];
  lines.push(inPlay.has('mordred') ? 'evilThumbsNotMordred' : 'evilThumbs', 'merlinOpen', 'merlinClose', 'evilThumbsDown');
  if (inPlay.has('percival')) {
    lines.push(inPlay.has('morgana') ? 'merlinMorganaThumbs' : 'merlinThumbs', 'percivalOpen', 'percivalClose', 'thumbsDown');
  }
  lines.push('everyoneOpen');
  return lines;
}
