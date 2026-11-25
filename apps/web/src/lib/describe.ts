import { phaseOf, teamOf, type Death, type Game, type NightEvent, type PromptKey, type Rules, type Setup } from '@sus/engine';
import type { Skin } from '../skins';

export const nameOf = (setup: Setup, id: string) => setup.players.find((p) => p.id === id)?.name ?? '?';

export function promptName(skin: Skin, key: PromptKey) {
  return key === 'mafia' ? skin.teams.mafia : skin.roles[key].name;
}

export function describeEvents(events: NightEvent[], setup: Setup, skin: Skin): string[] {
  const n = (id: string) => nameOf(setup, id);
  return events.flatMap((e) => {
    switch (e.type) {
      case 'blocked':
        return [`${n(e.player)} (${promptName(skin, e.key)}) was blocked`];
      case 'attack':
        if (e.outcome === 'killed') return [`${promptName(skin, e.by)} → ${n(e.target)}: killed`];
        if (e.outcome === 'guarded') return [`${promptName(skin, e.by)} → ${n(e.target)}: the ${skin.roles.bodyguard.name} stepped in`];
        return [`${promptName(skin, e.by)} → ${n(e.target)}: saved by the ${promptName(skin, e.savedBy!)}`];
      case 'guardDied':
        return [`${n(e.bodyguard)} died protecting ${n(e.protecting)}`];
      case 'heartbreak':
        return [`${n(e.partner)} died of heartbreak`];
      case 'check':
        return [`${skin.roles.detective.name} checked ${n(e.target)}: ${e.result === 'mafia' ? '👎 ' + skin.teams.mafia : '👍 not ' + skin.teams.mafia}`];
      case 'partner':
        return [];
    }
  });
}

export function deathLabel(death: Death, setup: Setup, rules: Rules, skin: Skin) {
  const role = setup.roles[death.player]!;
  if (rules.deathReveal === 'full') return skin.roles[role].name;
  if (rules.deathReveal === 'team') return skin.teams[teamOf(role)];
  return null;
}

export function stepSummary(game: Game, index: number, deaths: Death[], skin: Skin) {
  const { kind, number } = phaseOf(index);
  const title = `${kind === 'night' ? 'Night' : 'Day'} ${number}`;
  const mine = deaths.filter((d) => d.step === index);
  const text = mine.length
    ? mine.map((d) => `${nameOf(game.setup, d.player)} (${skin.roles[game.setup.roles[d.player]!].name})`).join(', ') + ' died'
    : kind === 'night' ? 'Nobody died' : 'Nobody was voted out';
  return { title, text };
}
