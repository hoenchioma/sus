// Saves finished games to the stats database (D1). Names are turned into keyed hashes here and never stored,
// and recording problems are only logged: stats must never get in the way of a game.
import type { GameRecord } from '@sus/engine';

export interface StatsEnv {
  /** Missing when the deploy couldn't set up the database (e.g. the API token lacks D1 access). */
  STATS?: D1Database;
  /** Key for the name and device codes. Created once by the deploy script; changing it breaks the link to older games. */
  STATS_SECRET?: string;
}

/** Same person, same code: "  Jane  DOE " and "jane doe" are one player. */
export const normalizeName = (name: string) => name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

export const isDeviceId = (v: unknown): v is string => typeof v === 'string' && /^[\w-]{8,64}$/.test(v);

let warnedNoSecret = false;

async function coder(env: StatsEnv) {
  let secret = env.STATS_SECRET;
  if (!secret) {
    // Only expected in local development; deploys always set one.
    if (!warnedNoSecret) console.warn('STATS_SECRET is not set; using a development key for stats codes');
    warnedNoSecret = true;
    secret = 'local-development-only';
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return async (kind: 'name' | 'device', value: string) => {
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${kind}:${value}`));
    return [...new Uint8Array(mac).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** Writes (or rewrites, if the same game ends again after an undo) one game and its seats. */
export async function saveRecord(env: StatsEnv, record: GameRecord, phoneDevice: string | null = null) {
  const db = env.STATS;
  if (!db) return;
  const code = await coder(env);
  const hostSeat = record.seats.find((s) => s.host);
  const phone = phoneDevice ?? hostSeat?.device ?? null;

  const game = db
    .prepare(
      `INSERT OR REPLACE INTO games (id, family, source, skin, is_test, started_at, ended_at, players, winner, end_reason, rounds, balance, phone_code, settings, timeline, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.family,
      record.source,
      record.skin,
      record.test ? 1 : 0,
      iso(record.startedAt),
      iso(record.endedAt),
      record.players,
      record.winner,
      record.endReason,
      record.rounds,
      record.balance,
      phone ? await code('device', phone) : null,
      JSON.stringify(record.settings),
      JSON.stringify(record.timeline),
      record.version,
    );
  const insertSeat = db.prepare(
    `INSERT INTO game_players (game_id, seat, name_code, device_code, is_host, role, team, won, survived, died_round, died_phase, died_cause, stats)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const seats = await Promise.all(
    record.seats.map(async (s) =>
      insertSeat.bind(
        record.id,
        s.seat,
        await code('name', normalizeName(s.name)),
        s.device ? await code('device', s.device) : null,
        s.host ? 1 : 0,
        s.role,
        s.team,
        s.won ? 1 : 0,
        s.survived === null ? null : s.survived ? 1 : 0,
        s.diedRound,
        s.diedPhase,
        s.diedCause,
        JSON.stringify(s.stats),
      ),
    ),
  );
  await db.batch([game, db.prepare('DELETE FROM game_players WHERE game_id = ?').bind(record.id), ...seats]);
}
