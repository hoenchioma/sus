import type { PromptKey, RoleId, Team, Winner } from '@sus/engine';

export type SkinId = 'mafia' | 'werewolf';

interface RoleText {
  name: string;
  blurb: string;
}

export interface Skin {
  id: SkinId;
  label: string;
  roles: Record<RoleId, RoleText>;
  teams: Record<Team, string>;
  prompts: Record<PromptKey, string>;
  wins: Record<Winner, string>;
}

const mafia: Skin = {
  id: 'mafia',
  label: 'Mafia',
  roles: {
    villager: { name: 'Villager', blurb: 'No powers. Just your wits and your vote.' },
    mafia: { name: 'Mafia', blurb: 'Choose someone to eliminate with your team each night.' },
    godfather: { name: 'Godfather', blurb: 'Leads the Mafia and has the final say on the kill.' },
    roleblocker: { name: 'Roleblocker', blurb: "Mafia. Cancel one player's ability each night." },
    doctor: { name: 'Doctor', blurb: 'Protect one player from being killed each night.' },
    detective: { name: 'Detective', blurb: 'Check one player each night: Mafia or not?' },
    bodyguard: { name: 'Bodyguard', blurb: 'Guard one player. If they are attacked, you die instead.' },
    lover: { name: 'Lover', blurb: 'Protect a partner each night. If you die, so do they.' },
    vigilante: { name: 'Vigilante', blurb: 'Once per game, take a shot at night.' },
    mayor: { name: 'Mayor', blurb: 'Reveal yourself in the day and your vote counts twice.' },
    serialKiller: { name: 'Serial Killer', blurb: 'Kill every night. Win by being the last one standing.' },
    jester: { name: 'Jester', blurb: 'Get yourself voted out and you win.' },
  },
  teams: { village: 'Village', mafia: 'Mafia', neutral: 'Neutral' },
  prompts: {
    roleblocker: 'Roleblocker, who do you block?',
    mafia: 'Mafia, who do you eliminate?',
    serialKiller: 'Serial Killer, who do you kill?',
    vigilante: 'Vigilante, do you take a shot?',
    bodyguard: 'Bodyguard, who do you guard?',
    doctor: 'Doctor, who do you protect?',
    lover: 'Lover, who do you spend the night with?',
    detective: 'Detective, who do you check?',
  },
  wins: {
    village: 'The Village wins',
    mafia: 'The Mafia wins',
    serialKiller: 'The Serial Killer wins',
    jester: 'The Jester wins',
    draw: 'Nobody survived',
  },
};

const werewolf: Skin = {
  id: 'werewolf',
  label: 'Werewolf',
  roles: {
    villager: { name: 'Villager', blurb: 'No powers. Just your wits and your vote.' },
    mafia: { name: 'Werewolf', blurb: 'Hunt one villager with your pack each night.' },
    godfather: { name: 'Alpha Wolf', blurb: 'Leads the pack and has the final say on the hunt.' },
    roleblocker: { name: 'Witch', blurb: "Werewolf ally. Hex one player's ability each night." },
    doctor: { name: 'Healer', blurb: 'Protect one player from the wolves each night.' },
    detective: { name: 'Seer', blurb: 'Gaze at one player each night: wolf or not?' },
    bodyguard: { name: 'Guardian', blurb: 'Guard one player. If they are attacked, you die instead.' },
    lover: { name: 'Lover', blurb: 'Protect a partner each night. If you die, so do they.' },
    vigilante: { name: 'Hunter', blurb: 'Once per game, fire a silver arrow at night.' },
    mayor: { name: 'Elder', blurb: 'Reveal yourself in the day and your vote counts twice.' },
    serialKiller: { name: 'Lone Wolf', blurb: 'Hunt alone every night. Win by being the last one standing.' },
    jester: { name: 'Fool', blurb: 'Get yourself voted out and you win.' },
  },
  teams: { village: 'Village', mafia: 'Werewolves', neutral: 'Loners' },
  prompts: {
    roleblocker: 'Witch, who do you hex?',
    mafia: 'Werewolves, who do you hunt?',
    serialKiller: 'Lone Wolf, who do you hunt?',
    vigilante: 'Hunter, do you fire your arrow?',
    bodyguard: 'Guardian, who do you guard?',
    doctor: 'Healer, who do you protect?',
    lover: 'Lover, who do you spend the night with?',
    detective: 'Seer, who do you gaze at?',
  },
  wins: {
    village: 'The Village wins',
    mafia: 'The Werewolves win',
    serialKiller: 'The Lone Wolf wins',
    jester: 'The Fool wins',
    draw: 'Nobody survived',
  },
};

export const SKINS: Record<SkinId, Skin> = { mafia, werewolf };
