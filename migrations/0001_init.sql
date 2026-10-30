-- Schéma initial complet pour une base neuve.
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
	default_stack INTEGER NOT NULL DEFAULT 10000,
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
	revision INTEGER NOT NULL DEFAULT 0,
	season_id TEXT NOT NULL REFERENCES seasons(id),
	name TEXT NOT NULL,
	played_at TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'finished')),
	multiplier INTEGER NOT NULL DEFAULT 1 CHECK (multiplier IN (1, 2)),
	buy_in REAL NOT NULL DEFAULT 10,
	starting_stack INTEGER NOT NULL DEFAULT 10000,
	rebuy_duration INTEGER NOT NULL DEFAULT 90 CHECK (rebuy_duration >= 0),
	structure_json TEXT NOT NULL,
	clock_json TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tournament_players (
	tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	player_id TEXT NOT NULL REFERENCES players(id),
	entries INTEGER NOT NULL DEFAULT 1,
	rebuy_order INTEGER CHECK (rebuy_order > 0),
	finish_rank INTEGER,
	-- Renseigné à l'élimination ; le gagnant reste à NULL jusqu'à la clôture.
	eliminated_at TEXT,
	seat INTEGER,
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
CREATE INDEX idx_tp_finish ON tournament_players (tournament_id, finish_rank);
CREATE INDEX idx_tp_seat ON tournament_players (tournament_id, seat);
CREATE UNIQUE INDEX idx_tp_rebuy_order ON tournament_players (tournament_id, rebuy_order);
CREATE INDEX idx_h72_tournament ON hands_72 (tournament_id, player_id);
CREATE UNIQUE INDEX idx_one_running_tournament ON tournaments(status) WHERE status = 'running';

CREATE TABLE admin_sessions (
	token_hash TEXT PRIMARY KEY,
	expires_at INTEGER NOT NULL
);
CREATE INDEX idx_admin_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE login_attempts (
	bucket TEXT PRIMARY KEY,
	attempts INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE tournament_commands (
	tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
	command_id TEXT NOT NULL,
	expected_revision INTEGER NOT NULL,
	payload TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY(tournament_id, command_id)
);

CREATE TRIGGER command_revision_guard BEFORE INSERT ON tournament_commands
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM tournaments WHERE id = NEW.tournament_id AND revision = NEW.expected_revision
	) THEN RAISE(ABORT, 'revision_conflict') END;
END;

CREATE TRIGGER season_public_revision AFTER UPDATE ON seasons
BEGIN
	UPDATE tournaments SET revision = revision + 1 WHERE season_id = NEW.id;
END;

CREATE TRIGGER player_public_revision AFTER UPDATE OF name ON players
BEGIN
	UPDATE tournaments SET revision = revision + 1 WHERE id IN (
		SELECT tournament_id FROM tournament_players WHERE player_id = NEW.id
	);
END;

INSERT INTO blind_structures (id, name, levels_json, is_default) VALUES (
	'default',
	'Standard — 15 min',
	'[
		{"sb":25,"bb":50,"ante":0,"duration":15},
		{"sb":50,"bb":100,"ante":0,"duration":15},
		{"sb":75,"bb":150,"ante":0,"duration":15},
		{"sb":100,"bb":200,"ante":0,"duration":15},
		{"sb":150,"bb":300,"ante":0,"duration":15},
		{"sb":200,"bb":400,"ante":0,"duration":15},
		{"sb":250,"bb":500,"ante":0,"duration":15},
		{"sb":300,"bb":600,"ante":0,"duration":15},
		{"sb":400,"bb":800,"ante":0,"duration":15},
		{"sb":500,"bb":1000,"ante":0,"duration":15},
		{"sb":600,"bb":1200,"ante":0,"duration":15},
		{"sb":800,"bb":1600,"ante":0,"duration":15},
		{"sb":1200,"bb":2400,"ante":0,"duration":15},
		{"sb":1500,"bb":3000,"ante":0,"duration":15},
		{"sb":2000,"bb":4000,"ante":0,"duration":15}
	]',
	1
);
