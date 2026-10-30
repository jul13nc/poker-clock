ALTER TABLE tournament_players
ADD COLUMN rebuy_order INTEGER CHECK (rebuy_order > 0);

CREATE UNIQUE INDEX idx_tp_rebuy_order
ON tournament_players (tournament_id, rebuy_order);
