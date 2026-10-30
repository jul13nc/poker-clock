import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	getParticipants,
	getStandingsPointsExcluding,
	getStandingsPoints,
	getTournament
} from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { formatEuro } from '#lib/domain/format';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) error(404, 'Tournoi introuvable.');

	const [participants, before, current] = await Promise.all([
		getParticipants(db, params.id),
		getStandingsPointsExcluding(db, tournament.season_id, tournament.id),
		getStandingsPoints(db, tournament.season_id)
	]);

	const beforeById = new Map(before.map((row) => [row.id, row]));
	const finished = tournament.status === 'finished';

	// Ordre du jour : places définitives d'abord, joueurs encore en jeu ensuite.
	const ordered = [...participants].sort((a, b) => {
		if (a.finish_rank === null && b.finish_rank === null) {
			return a.name.localeCompare(b.name, 'fr');
		}
		if (a.finish_rank === null) return 1;
		if (b.finish_rank === null) return -1;
		return a.finish_rank - b.finish_rank;
	});

	const totalEntries = participants.reduce((sum, participant) => sum + participant.entries, 0);
	const pool = tournament.buy_in * totalEntries;
	// Les gains affichés sont ceux réellement enregistrés à la clôture.
	const payouts = finished
		? participants
				.filter((participant) => (participant.prize ?? 0) > 0 && participant.finish_rank !== null)
				.map((participant) => ({
					place: participant.finish_rank as number,
					amount: participant.prize as number
				}))
				.sort((a, b) => a.place - b.place)
		: [];

	const rows = ordered.map((participant) => {
		const previous = beforeById.get(participant.player_id);
		const dayPoints = finished ? (participant.points ?? 0) : null;
		const previousPoints = previous?.points ?? 0;

		return {
			playerId: participant.player_id,
			name: participant.name,
			entries: participant.entries,
			rebuyOrder: participant.rebuy_order,
			hands72: participant.hands72,
			finishRank: participant.finish_rank,
			dayPoints,
			dayPointsRank: participant.points_rank,
			prize: finished ? (participant.prize ?? 0) : null,
			previousPoints,
			previousPlayed: previous?.played ?? 0,
			totalPoints: previousPoints + (dayPoints ?? 0),
			totalPlayed: (previous?.played ?? 0) + (finished ? 1 : 0)
		};
	});

	// Choix métier : classement actuel de toute la saison, ex æquo aux points.
	const rankByPlayer = new Map(current.map((player) => [player.id, player.rank]));

	return {
		tournament,
		finished,
		rows: rows.map((row) => ({
			...row,
			generalRank: rankByPlayer.get(row.playerId) ?? null
		})),
		payouts,
		totals: {
			entries: totalEntries,
			pool,
			poolLabel: formatEuro(pool),
			hands72: participants.reduce((sum, participant) => sum + participant.hands72, 0)
		}
	};
};
