export type Level = {
	sb: number;
	bb: number;
	ante: number;
	/** Durée du niveau en minutes. */
	duration: number;
	break?: boolean;
	label?: string;
};

export type ClockState = {
	startedAt: number;
	pausedAt: number | null;
	pausedTotalMs: number;
	/** Ajustement manuel (niveau suivant/précédent, temps ajouté). */
	offsetMs: number;
};

export type ClockStatus = 'idle' | 'running' | 'paused' | 'finished';

export type ClockView = {
	status: ClockStatus;
	/** -1 quand l'horloge n'a pas démarré. */
	index: number;
	level: Level | null;
	next: Level | null;
	elapsedMs: number;
	remainingMs: number;
	durationMs: number;
	levelStartMs: number;
	totalMs: number;
	/** Progression dans le niveau courant, entre 0 et 1. */
	progress: number;
};

export type TournamentStatus = 'draft' | 'running' | 'finished';

export type PlayerState = {
	id: string;
	name: string;
	entries: number;
	/** Ordre de la première recave dans le tournoi, inconnu pour les anciennes données. */
	rebuyOrder: number | null;
	hands72: number;
	/** Place à table tirée au sort, sinon null. */
	seat: number | null;
	/** Place finale si le joueur est éliminé, sinon null. */
	finishRank: number | null;
	eliminatedAt: string | null;
};

export type TournamentState = {
	id: string;
	revision: number;
	name: string;
	status: TournamentStatus;
	multiplier: number;
	buyIn: number;
	/** Durée des recaves en minutes de jeu, pauses manuelles exclues. */
	rebuyDuration: number;
	startingStack: number;
	totalChips: number;
	remaining: number;
	averageStack: number;
	/** Gains par place, selon la table de la saison et les entrées actuelles. */
	payouts: { place: number; amount: number }[];
	playedAt: string;
	seasonName: string;
	clock: ClockState | null;
	levels: Level[];
	players: PlayerState[];
};

export type Season = {
	id: string;
	name: string;
	starts_on: string;
	ends_on: string;
	points_scale_json: string;
	payout_json: string;
	default_buyin: number;
	default_stack: number;
	rebuy_rule: 'after' | 'normal';
	created_at: string;
};

export type TournamentRow = {
	id: string;
	revision: number;
	season_id: string;
	name: string;
	played_at: string;
	status: TournamentStatus;
	multiplier: number;
	buy_in: number;
	rebuy_duration: number;
	starting_stack: number;
	structure_json: string;
	clock_json: string | null;
	created_at: string;
};

export type TournamentWithSeason = TournamentRow & {
	season_name: string;
	points_scale_json: string;
	payout_json: string;
	rebuy_rule: 'after' | 'normal';
	default_buyin: number;
};

export type Participant = {
	player_id: string;
	name: string;
	entries: number;
	rebuy_order: number | null;
	finish_rank: number | null;
	points: number | null;
	points_rank: number | null;
	prize: number | null;
	hands72: number;
	seat: number | null;
	eliminated_at: string | null;
};
