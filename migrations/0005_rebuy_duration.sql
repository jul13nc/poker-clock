ALTER TABLE tournaments
ADD COLUMN rebuy_duration INTEGER NOT NULL DEFAULT 90 CHECK (rebuy_duration >= 0);
