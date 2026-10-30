import type { D1Database } from '@cloudflare/workers-types';
import { queryAll, queryOne } from './db';

type ParticipantRow = {
	player_id: string;
	finish_rank: number | null;
};

/**
 * Élimine un joueur et lui attribue la dernière place encore libre.
 *
 * Le classement se construit donc de la fin vers le début : le premier éliminé
 * prend la n-ième place, le dernier éliminé la 2e, et le survivant est déclaré
 * vainqueur à la clôture.
 *
 * @returns un message d'erreur, ou null en cas de succès.
 */
export async function eliminatePlayer(
	db: D1Database,
	tournamentId: string,
	playerId: string,
	now: string = new Date().toISOString()
): Promise<string | null> {
	const rows = await queryAll<ParticipantRow>(
		db,
		'SELECT player_id, finish_rank FROM tournament_players WHERE tournament_id = ?',
		tournamentId
	);

	const player = rows.find((row) => row.player_id === playerId);
	if (!player) return 'Joueur absent de ce tournoi.';
	if (player.finish_rank !== null) return 'Ce joueur est déjà éliminé.';

	const remainingBefore = rows.filter((row) => row.finish_rank === null).length;
	if (remainingBefore <= 1) {
		return "Il ne reste qu'un joueur : clôturez le tournoi pour désigner le vainqueur.";
	}

	await db
		.prepare(
			`UPDATE tournament_players
			 SET finish_rank = ?, eliminated_at = ?
			 WHERE tournament_id = ? AND player_id = ?`
		)
		.bind(remainingBefore, now, tournamentId, playerId)
		.run();

	return null;
}

/**
 * Annule la dernière élimination saisie (celle qui occupe la plus petite place).
 */
export async function cancelLastElimination(
	db: D1Database,
	tournamentId: string
): Promise<string | null> {
	const last = await queryOne<{ player_id: string }>(
		db,
		`SELECT player_id FROM tournament_players
		 WHERE tournament_id = ? AND finish_rank IS NOT NULL
		 ORDER BY finish_rank ASC
		 LIMIT 1`,
		tournamentId
	);
	if (!last) return 'Aucune élimination à annuler.';

	await db
		.prepare(
			`UPDATE tournament_players
			 SET finish_rank = NULL, eliminated_at = NULL
			 WHERE tournament_id = ? AND player_id = ?`
		)
		.bind(tournamentId, last.player_id)
		.run();

	return null;
}

/**
 * Recalcule les places des joueurs éliminés pour qu'elles restent contiguës
 * (n, n-1, …) après une ré-entrée ou une annulation.
 */
export async function renumberEliminations(db: D1Database, tournamentId: string): Promise<void> {
	const total = await queryOne<{ count: number }>(
		db,
		'SELECT COUNT(*) AS count FROM tournament_players WHERE tournament_id = ?',
		tournamentId
	);
	const playerCount = total?.count ?? 0;

	const eliminated = await queryAll<{ player_id: string }>(
		db,
		`SELECT player_id FROM tournament_players
		 WHERE tournament_id = ? AND finish_rank IS NOT NULL
		 ORDER BY COALESCE(eliminated_at, '') ASC, finish_rank DESC`,
		tournamentId
	);
	if (eliminated.length === 0) return;

	await db.batch(
		eliminated.map((row, index) =>
			db
				.prepare(
					`UPDATE tournament_players SET finish_rank = ?
					 WHERE tournament_id = ? AND player_id = ?`
				)
				.bind(playerCount - index, tournamentId, row.player_id)
		)
	);
}

/**
 * Réintègre un joueur éliminé qui recave : sa place est libérée et les places
 * des autres éliminés sont recalculées.
 */
export async function reinstatePlayer(
	db: D1Database,
	tournamentId: string,
	playerId: string
): Promise<void> {
	await db
		.prepare(
			`UPDATE tournament_players
			 SET finish_rank = NULL, eliminated_at = NULL
			 WHERE tournament_id = ? AND player_id = ?`
		)
		.bind(tournamentId, playerId)
		.run();
	await renumberEliminations(db, tournamentId);
}
