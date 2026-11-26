import { playQuest } from './quest.mjs';

export const play = (browser, base, artifacts) => playQuest(browser, base, artifacts, { skin: 'avalon', players: 10, preset: 'Full' });
