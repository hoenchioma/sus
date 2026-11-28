-- Long-term, anonymous game stats. One row per finished game, one per seat.
-- Players are never stored by name: name_code is a keyed hash of the normalised name (the same name gives the
-- same code across games), and device_code a keyed hash of a random ID kept on each phone.

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  family TEXT NOT NULL,          -- mafia (Mafia/Werewolf) | quest (Polashi/Avalon)
  source TEXT NOT NULL,          -- phones (everyone on their phone) | tracker (one phone, run by the host)
  skin TEXT NOT NULL,            -- mafia | werewolf | polashi | avalon
  is_test INTEGER NOT NULL,      -- 1 for the automated test games
  started_at TEXT,               -- ISO 8601, UTC
  ended_at TEXT NOT NULL,
  players INTEGER NOT NULL,
  winner TEXT NOT NULL,          -- mafia: village | mafia | serialKiller | jester | draw; quest: good | evil; none = stopped by the host
  end_reason TEXT NOT NULL,      -- mafia: win | jester | host; quest: chapters | rejections | guessed | missed | host
  rounds INTEGER NOT NULL,       -- mafia: nights played; quest: chapters played
  balance REAL,                  -- the setup screen's balance score (positive favours the village / good side)
  phone_code TEXT,               -- device code of the phone that ran a one-phone game, or of the host's phone
  settings TEXT NOT NULL,        -- JSON: roles and house rules in effect
  timeline TEXT NOT NULL,        -- JSON: every step of the game, with players as seat numbers
  version INTEGER NOT NULL       -- shape of settings/timeline/stats; see packages/engine/src/stats.ts
);

CREATE TABLE game_players (
  game_id TEXT NOT NULL,
  seat INTEGER NOT NULL,         -- seating order, from 0
  name_code TEXT NOT NULL,
  device_code TEXT,              -- null in one-phone games
  is_host INTEGER NOT NULL,
  role TEXT NOT NULL,
  team TEXT NOT NULL,            -- mafia: village | mafia | neutral; quest: good | evil
  won INTEGER NOT NULL,
  survived INTEGER,              -- mafia only
  died_round INTEGER,
  died_phase TEXT,               -- night | day
  died_cause TEXT,               -- mafia | serialKiller | vigilante | guarding | heartbreak | vote | host
  stats TEXT NOT NULL,           -- JSON counts, e.g. votes, votesOn_mafia, approvedEvilTeams, betrayals
  PRIMARY KEY (game_id, seat)
);

CREATE INDEX games_ended ON games (ended_at);
CREATE INDEX game_players_name ON game_players (name_code);
CREATE INDEX game_players_device ON game_players (device_code);
