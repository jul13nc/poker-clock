import type { D1Database } from '@cloudflare/workers-types';
import { seasonWindow } from '#lib/domain/format';
import { averageStack, totalChips } from '#lib/domain/tournament';
import { computePayouts, parsePayoutTableJson } from '#lib/domain/payout';
import { DEFAULT_PAYOUT_TABLE } from '#lib/domain/defaults';
import type {
	Level,
	Participant,
	Season,
	TournamentState,
	TournamentWithSeason
} from '#lib/domain/types';
import { queryAll, queryOne } from './db';

export type PlayerRow = {
	id: string;
	name: string;
	active: number;
	created_at: string;
};

export type TournamentListItem = TournamentWithSeason & {
	player_count: number;
	entries_count: number;
};

export type StandingPoints = {
	id: string;
	name: string;
	points: number;
	played: number;
	wins: number;
};

export type Standing72 = {
	id: string;
	name: string;
	hands: number;
	tournaments: number;
};

export type BlindStructure = {
	id: string;
	name: string;
	levels_json: string;
	is_default: number;
};

export function parseLevels(json: string): Level[] {
	try {
		const parsed = JSON.parse(json);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((level) => level && typeof level === 'object')
			.map((level) => ({
				sb: Number(level.sb) || 0,
				bb: Number(level.bb) || 0,
				ante: Number(level.ante) || 0,
				duration: Number(level.duration) || 0,
				break: Boolean(level.break),
				label: typeof level.label === 'string' ? level.label : undefined
			}));
	} catch {
		return [];
	}
}

export function parseJsonNumberList(json: string, fallback: number[]): number[] {
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed) && parsed.every((value) => Number.isFinite(value))) {
			return parsed.map(Number);
		}
	} catch {
		// ignore
	}
	return fallback;
}

export async function ensureSeason(db: D1Database): Promise<Season> {
	const { start, end, name } = seasonWindow();

	// Lecture d'abord : la saison existe déjà dans la quasi-totalité des requêtes.
	const existing = await queryOne<Season>(db, 'SELECT * FROM seasons WHERE starts_on = ?', start);
	if (existing) return existing;

	// Première requête de la saison : on la crée une seule fois.
	await db
		.prepare(
			'INSERT OR IGNORE INTO seasons (id, name, starts_on, ends_on) VALUES (?, ?, ?, ?)'
		)
		.bind(crypto.randomUUID(), name, start, end)
		.run();

	const season = await queryOne<Season>(db, 'SELECT * FROM seasons WHERE starts_on = ?', start);
	if (!season) throw new Error('Impossible de créer la saison courante.');
	return season;
}

export async function getSeasonById(db: D1Database, id: string): Promise<Season | null> {
	return queryOne<Season>(db, 'SELECT * FROM seasons WHERE id = ?', id);
}

export async function updateSeason(
	db: D1Database,
	id: string,
	values: {
		name: string;
		points_scale_json: string;
		payout_json: string;
		default_buyin: number;
		default_stack: number;
		rebuy_rule: 'after' | 'normal';
	}
): Promise<void> {
	await db
		.prepare(
			`UPDATE seasons
			 SET name = ?, points_scale_json = ?, payout_json = ?, default_buyin = ?,
			     default_stack = ?, rebuy_rule = ?
			 WHERE id = ?`
		)
		.bind(
			values.name,
			values.points_scale_json,
			values.payout_json,
			values.default_buyin,
			values.default_stack,
			values.rebuy_rule,
			id
		)
		.run();
}

export async function listPlayers(db: D1Database): Promise<PlayerRow[]> {
	return queryAll<PlayerRow>(db, 'SELECT * FROM players ORDER BY active DESC, name COLLATE NOCASE');
}

export async function listActivePlayers(db: D1Database): Promise<PlayerRow[]> {
	return queryAll<PlayerRow>(db, 'SELECT * FROM players WHERE active = 1 ORDER BY name COLLATE NOCASE');
}

export async function insertPlayer(db: D1Database, name: string): Promise<string> {
	const id = crypto.randomUUID();
	await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run();
	return id;
}

export async function togglePlayer(db: D1Database, id: string): Promise<void> {
	await db.prepare('UPDATE players SET active = 1 - active WHERE id = ?').bind(id).run();
}

export async function listTournaments(
	db: D1Database,
	seasonId: string
): Promise<TournamentListItem[]> {
	return queryAll<TournamentListItem>(
		db,
		`SELECT t.*, s.name AS season_name, s.points_scale_json, s.payout_json,
		        s.rebuy_rule, s.default_buyin,
		        (SELECT COUNT(*) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS player_count,
		        (SELECT COALESCE(SUM(tp.entries), 0) FROM tournament_players tp WHERE tp.tournament_id = t.id) AS entries_count
		 FROM tournaments t
		 JOIN seasons s ON s.id = t.season_id
		 WHERE t.season_id = ?
		 ORDER BY t.played_at DESC, t.created_at DESC`,
		seasonId
	);
}

export async function getTournament(
	db: D1Database,
	id: string
): Promise<TournamentWithSeason | null> {
	return queryOne<TournamentWithSeason>(
		db,
		`SELECT t.*, s.name AS season_name, s.points_scale_json, s.payout_json,
		        s.rebuy_rule, s.default_buyin
		 FROM tournaments t
		 JOIN seasons s ON s.id = t.season_id
		 WHERE t.id = ?`,
		id
	);
}

export async function getParticipants(
	db: D1Database,
	tournamentId: string
): Promise<Participant[]> {
	return queryAll<Participant>(
		db,
		`SELECT tp.player_id, p.name, tp.entries, tp.rebuy_order, tp.finish_rank, tp.points,
		        tp.points_rank, tp.prize, tp.seat, tp.eliminated_at,
		        COALESCE((
		          SELECT SUM(h.count) FROM hands_72 h
		          WHERE h.tournament_id = tp.tournament_id AND h.player_id = tp.player_id
		        ), 0) AS hands72
		 FROM tournament_players tp
		 JOIN players p ON p.id = tp.player_id
		 WHERE tp.tournament_id = ?
		 ORDER BY (tp.finish_rank IS NULL), tp.finish_rank, p.name COLLATE NOCASE`,
		tournamentId
	);
}

export async function getStandingsPoints(
	db: D1Database,
	seasonId: string
): Promise<StandingPoints[]> {
	return queryAll<StandingPoints>(
		db,
		`SELECT p.id, p.name,
		        COALESCE(SUM(tp.points), 0) AS points,
		        COUNT(*) AS played,
		        SUM(CASE WHEN tp.finish_rank = 1 THEN 1 ELSE 0 END) AS wins
		 FROM tournament_players tp
		 JOIN players p ON p.id = tp.player_id
		 JOIN tournaments t ON t.id = tp.tournament_id
		 WHERE t.season_id = ? AND t.status = 'finished' AND tp.finish_rank IS NOT NULL
		 GROUP BY p.id, p.name
		 ORDER BY points DESC, wins DESC, p.name COLLATE NOCASE`,
		seasonId
	);
}

/**
 * Classement de la saison en ignorant un tournoi donné. Sert à calculer le cumul
 * « avant » puis « après » la journée affichée dans la synthèse.
 */
export async function getStandingsPointsExcluding(
	db: D1Database,
	seasonId: string,
	excludedTournamentId: string
): Promise<StandingPoints[]> {
	return queryAll<StandingPoints>(
		db,
		`SELECT p.id, p.name,
		        COALESCE(SUM(tp.points), 0) AS points,
		        COUNT(*) AS played,
		        SUM(CASE WHEN tp.finish_rank = 1 THEN 1 ELSE 0 END) AS wins
		 FROM tournament_players tp
		 JOIN players p ON p.id = tp.player_id
		 JOIN tournaments t ON t.id = tp.tournament_id
		 WHERE t.season_id = ? AND t.status = 'finished' AND tp.finish_rank IS NOT NULL
		   AND t.id <> ?
		 GROUP BY p.id, p.name
		 ORDER BY points DESC, wins DESC, p.name COLLATE NOCASE`,
		seasonId,
		excludedTournamentId
	);
}

export async function getStandings72(db: D1Database, seasonId: string): Promise<Standing72[]> {
	return queryAll<Standing72>(
		db,
		`SELECT p.id, p.name,
		        SUM(h.count) AS hands,
		        COUNT(DISTINCT h.tournament_id) AS tournaments
		 FROM hands_72 h
		 JOIN players p ON p.id = h.player_id
		 JOIN tournaments t ON t.id = h.tournament_id
		 WHERE t.season_id = ? AND t.status = 'finished'
		 GROUP BY p.id, p.name
		 ORDER BY hands DESC, p.name COLLATE NOCASE`,
		seasonId
	);
}

export async function getDefaultStructure(db: D1Database): Promise<BlindStructure | null> {
	return queryOne<BlindStructure>(
		db,
		'SELECT * FROM blind_structures ORDER BY is_default DESC, name LIMIT 1'
	);
}

export async function listStructures(db: D1Database): Promise<BlindStructure[]> {
	return queryAll<BlindStructure>(
		db,
		'SELECT * FROM blind_structures ORDER BY is_default DESC, name'
	);
}

export async function buildTournamentState(
	db: D1Database,
	id: string
): Promise<TournamentState | null> {
	const tournament = await getTournament(db, id);
	if (!tournament) return null;
	const participants = await getParticipants(db, id);

	const totalEntries = participants.reduce((sum, participant) => sum + participant.entries, 0);
	const chips = totalChips(tournament.starting_stack, totalEntries);
	const remaining = participants.filter((participant) => participant.finish_rank === null).length;
	const payoutTable = parsePayoutTableJson(tournament.payout_json, DEFAULT_PAYOUT_TABLE);
	const payouts = computePayouts(
		participants.length,
		totalEntries,
		tournament.buy_in,
		payoutTable
	).map((line) => ({ place: line.place, amount: line.amount }));

	return {
		id: tournament.id,
		name: tournament.name,
		status: tournament.status,
		multiplier: tournament.multiplier,
		buyIn: tournament.buy_in,
		rebuyDuration: tournament.rebuy_duration,
		startingStack: tournament.starting_stack,
		totalChips: chips,
		remaining,
		averageStack: averageStack(chips, remaining),
		payouts,
		playedAt: tournament.played_at,
		seasonName: tournament.season_name,
		clock: tournament.clock_json ? JSON.parse(tournament.clock_json) : null,
		levels: parseLevels(tournament.structure_json),
		players: participants.map((participant) => ({
			id: participant.player_id,
			name: participant.name,
			entries: participant.entries,
			rebuyOrder: participant.rebuy_order,
			hands72: participant.hands72,
			seat: participant.seat,
			finishRank: participant.finish_rank,
			eliminatedAt: participant.eliminated_at
		}))
	};
}
