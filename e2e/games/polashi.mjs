import { playQuest } from './quest.mjs';

export const play = (browser, base, artifacts) => playQuest(browser, base, artifacts, { skin: 'polashi', players: 7, preset: 'Classic' });
