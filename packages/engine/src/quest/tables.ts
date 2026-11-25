export const MIN_QUEST_PLAYERS = 5;
export const MAX_QUEST_PLAYERS = 15;

interface Table {
  good: number;
  evil: number;
  /** Team size for chapters 1–5. */
  teams: [number, number, number, number, number];
}

// Official table for 5–10 (identical in Avalon and Polashi); 11–15 is an unofficial house table.
export const TABLES: Record<number, Table> = {
  5: { good: 3, evil: 2, teams: [2, 3, 2, 3, 3] },
  6: { good: 4, evil: 2, teams: [2, 3, 4, 3, 4] },
  7: { good: 4, evil: 3, teams: [2, 3, 3, 4, 4] },
  8: { good: 5, evil: 3, teams: [3, 4, 4, 5, 5] },
  9: { good: 6, evil: 3, teams: [3, 4, 4, 5, 5] },
  10: { good: 6, evil: 4, teams: [3, 4, 4, 5, 5] },
  11: { good: 7, evil: 4, teams: [3, 4, 4, 5, 5] },
  12: { good: 7, evil: 5, teams: [3, 4, 4, 5, 5] },
  13: { good: 8, evil: 5, teams: [4, 4, 5, 5, 6] },
  14: { good: 9, evil: 5, teams: [4, 5, 5, 6, 6] },
  15: { good: 9, evil: 6, teams: [4, 5, 5, 6, 6] },
};

export const tableFor = (players: number): Table => {
  const table = TABLES[players];
  if (!table) throw new Error(`No quest table for ${players} players`);
  return table;
};

export const teamSize = (players: number, chapter: number) => tableFor(players).teams[chapter - 1]!;

/** Chapter 4 needs two Betrayals from 7 players up. */
export const failsNeeded = (players: number, chapter: number) => (chapter === 4 && players >= 7 ? 2 : 1);

export const isExperimental = (players: number) => players > 10;

/** How many optional evil powers (Morgana, Mordred, Oberon) fit at this player count. */
export const evilPowerCap = (players: number) => (players <= 6 ? 1 : players <= 9 ? 2 : 3);
