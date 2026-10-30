-- Suivi des éliminations en direct et tapis de départ.

ALTER TABLE seasons ADD COLUMN default_stack INTEGER NOT NULL DEFAULT 10000;

ALTER TABLE tournaments ADD COLUMN starting_stack INTEGER NOT NULL DEFAULT 10000;

-- Renseigné au moment de l'élimination. Le gagnant reste à NULL jusqu'à la clôture.
ALTER TABLE tournament_players ADD COLUMN eliminated_at TEXT;

CREATE INDEX idx_tp_finish ON tournament_players (tournament_id, finish_rank);
