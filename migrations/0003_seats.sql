-- Placement à table tiré au sort au début de la soirée.

ALTER TABLE tournament_players ADD COLUMN seat INTEGER;

CREATE INDEX idx_tp_seat ON tournament_players (tournament_id, seat);
