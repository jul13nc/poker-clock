PRAGMA foreign_keys = ON;

CREATE TABLE players (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL UNIQUE,
	active INTEGER NOT NULL DEFAULT 1,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE seasons (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	starts_on TEXT NOT NULL UNIQUE,
	ends_on TEXT NOT NULL,
	points_scale_json TEXT NOT NULL DEFAULT '[10,7,5,3,2,1]',
	payout_json TEXT NOT NULL DEFAULT '{"50":{"1":30,"2":20},"60":{"1":40,"2":20},"70":{"1":40,"2":20,"3":10},"80":{"1":40,"2":30,"3":10},"90":{"1":50,"2":30,"3":10},"100":{"1":60,"2":30,"3":10},"110":{"1":70,"2":30,"3":10},"120":{"1":70,"2":40,"3":10},"130":{"1":80,"2":40,"3":10},"140":{"1":90,"2":40,"3":10}}',
	default_buyin REAL NOT NULL DEFAULT 10,
	rebuy_rule TEXT NOT NULL DEFAULT 'after' CHECK (rebuy_rule IN ('after', 'normal')),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE blind_structures (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	levels_json TEXT NOT NULL,
	is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tournaments (
	id TEXT PRIMARY KEY,
	season_id TEXT NOT NULL REFERENCES seasons(id),
	name TEXT NOT NULL,
	played_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'finished')),
	multiplier INTEGER NOT NULL DEFAULT 1 CHECK (multiplier IN (1, 2)),
	buy_in REAL NOT NULL DEFAULT 10,
	structure_json TEXT NOT NULL,
	clock_json TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tournament_players (
	tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	player_id TEXT NOT NULL REFERENCES players(id),
	entries INTEGER NOT NULL DEFAULT 1,
	finish_rank INTEGER,
	points REAL,
	points_rank INTEGER,
	prize REAL,
	PRIMARY KEY (tournament_id, player_id)
);

CREATE TABLE hands_72 (
	id TEXT PRIMARY KEY,
	tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	player_id TEXT NOT NULL REFERENCES players(id),
	count INTEGER NOT NULL DEFAULT 1,
	note TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tournaments_season ON tournaments (season_id, played_at);
CREATE INDEX idx_tp_player ON tournament_players (player_id);
CREATE INDEX idx_h72_tournament ON hands_72 (tournament_id, player_id);

INSERT INTO blind_structures (id, name, levels_json, is_default) VALUES (
	'default',
	'Standard — 20 min',
	'[
		{"sb":25,"bb":50,"ante":0,"duration":20},
		{"sb":50,"bb":100,"ante":0,"duration":20},
		{"sb":75,"bb":150,"ante":0,"duration":20},
		{"sb":100,"bb":200,"ante":0,"duration":20},
		{"sb":150,"bb":300,"ante":0,"duration":20},
		{"sb":200,"bb":400,"ante":0,"duration":20},
		{"sb":0,"bb":0,"ante":0,"duration":15,"break":true,"label":"Pause"},
		{"sb":300,"bb":600,"ante":0,"duration":20},
		{"sb":400,"bb":800,"ante":0,"duration":20},
		{"sb":500,"bb":1000,"ante":0,"duration":20},
		{"sb":700,"bb":1400,"ante":0,"duration":20},
		{"sb":1000,"bb":2000,"ante":0,"duration":20},
		{"sb":1500,"bb":3000,"ante":0,"duration":20},
		{"sb":2000,"bb":4000,"ante":0,"duration":20},
		{"sb":3000,"bb":6000,"ante":0,"duration":20},
		{"sb":4000,"bb":8000,"ante":0,"duration":20},
		{"sb":5000,"bb":10000,"ante":0,"duration":20},
		{"sb":7000,"bb":14000,"ante":0,"duration":20}
	]',
	1
);
