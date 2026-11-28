// Short "how to play your role" lines for new players: how you win, what you do at night, and one tip.
// The tips follow the house rules in play, so they never tell a player something this game doesn't allow.
import { teamOf, type CardView, type RoleId, type Rules } from '@sus/engine';
import type { Skin } from '../skins';

export type NightStyle = 'quick' | 'narrated' | 'tracker';

export interface RoleGuide {
  win: string;
  night: string;
  tip: string;
}

export function roleGuide(role: RoleId, skin: Skin, rules: Rules, inPlay: Set<RoleId>, style: NightStyle): RoleGuide {
  const n = (r: RoleId) => skin.roles[r].name;
  const killers = skin.teams.mafia;
  const sk = inPlay.has('serialKiller') ? ` and the ${n('serialKiller')}` : '';

  const team = teamOf(role);
  const win =
    role === 'jester' ? (rules.jesterEnds ? 'You win the moment you are voted out. The game ends there.' : 'You win if you are voted out. The game carries on without you.') :
    role === 'serialKiller' ? 'You win only as the last one standing.' :
    team === 'mafia' ? `You win with the ${killers} once you match everyone else in number${sk ? `, with the ${n('serialKiller')} gone` : ''}.` :
    `You win with the ${skin.teams.village} once all the ${killers}${sk} are out.`;

  const quiet =
    style === 'quick' ? 'At night you answer two guessing questions, so your screen looks like everyone else’s.' : 'You are never woken at night. Keep your eyes closed.';
  const alternate = rules.protectorsAlternate ? ' You can’t pick the same person two nights in a row.' : '';

  switch (role) {
    case 'villager':
      return { win, night: quiet, tip: 'Your vote is your power. Listen for slips, and notice who pushes the vote and who stays quiet.' };
    case 'mafia':
      return {
        win,
        night: `Each night, choose someone to eliminate with the other ${killers}.`,
        tip: inPlay.has('godfather')
          ? `The ${n('godfather')} has the final say. By day, act like an ordinary ${n('villager')}.`
          : `Agree on a target: if your votes split, it's settled at random. By day, act like an ordinary ${n('villager')}.`,
      };
    case 'godfather':
      return {
        win,
        night: `Each night, your team votes on a target and your pick is final.`,
        tip: rules.godfatherInnocent && inPlay.has('detective')
          ? `The ${n('detective')} sees you as innocent, so you can afford to lead by day.`
          : inPlay.has('detective')
            ? `The ${n('detective')} can still find you, so don't draw attention.`
            : `Lead quietly: the more the others trust you, the longer you last.`,
      };
    case 'roleblocker':
      return {
        win,
        night: `Each night, pick a player whose power does nothing that night.`,
        tip: `Go after whoever you think is the ${n('doctor')} or the ${n('detective')}.${
          style === 'quick' ? ` You only vote on the kill once you're the last of the ${killers}.` : ` You also wake with the ${killers} to choose the kill.`
        }`,
      };
    case 'doctor': {
      const self = rules.doctorSelf === 'always' ? 'You can protect yourself.' : rules.doctorSelf === 'once' ? 'You can protect yourself once per game.' : 'You can’t protect yourself.';
      return { win, night: 'Each night, pick someone to protect. If they are attacked, they survive.', tip: `${self}${alternate}` };
    }
    case 'detective':
      return {
        win,
        night: `Each night, check one player and learn straight away whether they're with the ${killers}.`,
        tip: `Share what you learn carefully: once the ${killers} know who you are, you're next.${rules.godfatherInnocent && inPlay.has('godfather') ? ` The ${n('godfather')} shows as innocent to you.` : ''}`,
      };
    case 'bodyguard':
      return { win, night: 'Each night, guard one player. If they are attacked, you die in their place.', tip: `Guard whoever you think the ${killers} want most.${alternate}` };
    case 'lover':
      return {
        win,
        night: 'Each night, pick a partner to protect.',
        tip: `Your partner is named in the morning and can't vote that day. If you die at night, they die too.${rules.loverSelf ? '' : ' You can’t pick yourself.'}${alternate}`,
      };
    case 'vigilante':
      return { win, night: 'At night you may take one shot at a player, once per game. Pick nobody to save it.', tip: `Wait until you're fairly sure: hitting a ${n('villager')} helps the ${killers}.` };
    case 'mayor':
      return {
        win,
        night: quiet,
        tip: `By day you can reveal yourself, and from then on your vote counts twice. Choose the moment well: the ${killers} will know who you are.`,
      };
    case 'serialKiller':
      return {
        win,
        night: 'Each night, pick someone to kill.',
        tip: rules.skProtectable ? 'A protected player survives your attack. Blend in by day.' : 'Nothing can stop your attack. Blend in by day.',
      };
    case 'jester':
      return { win, night: quiet, tip: 'Look just suspicious enough to be voted out, but not so threatening that you get killed at night.' };
  }
}

/** One line under a night card, so a new player knows what their pick does. */
export function cardHint(card: CardView, skin: Skin, rules: Rules, hasGodfather: boolean, night: number): string | null {
  const n = (r: RoleId) => skin.roles[r].name;
  if (card.kind !== 'action') return 'Just a guess: everyone answers one, so nobody can tell who has a power. Good guesses earn a badge at the end.';
  switch (card.key) {
    case 'mafia':
      return hasGodfather ? `Your team's votes show live. The ${n('godfather')} has the final say.` : 'Your team’s votes show live. Most votes wins; a tie is settled at random.';
    case 'roleblocker':
      return 'Their power does nothing tonight.';
    case 'doctor':
      return `If they're attacked tonight, they survive.${rules.protectorsAlternate && night > 1 ? ' Not the same person as last night.' : ''}`;
    case 'bodyguard':
      return 'If they’re attacked tonight, you die in their place.';
    case 'lover':
      return 'They’re protected tonight, but if you die, they die too. They can’t vote tomorrow.';
    case 'detective':
      return `You'll see the answer straight away: ${skin.teams.mafia} or not.`;
    case 'vigilante':
      return 'You get one shot all game. Pick Nobody to keep it for later.';
    case 'serialKiller':
      return rules.skProtectable ? 'A protected player survives.' : null;
    default:
      return null;
  }
}

/** How the day's vote is decided, in a sentence. */
export function voteHint(rules: Rules, stage: 'vote' | 'runoff', needed: number | null): string {
  if (stage === 'runoff') {
    const tie = { bothDie: 'both are out', host: 'the host decides', random: 'one of them goes, at random', nobody: 'nobody is out' }[rules.tieBreak];
    return `Most votes is out. If it's still tied, ${tie}.`;
  }
  return needed === null
    ? 'Most votes is out. A tie for the top goes to a runoff.'
    : `It takes ${needed} votes to vote someone out. Otherwise the top two go to a runoff.`;
}
