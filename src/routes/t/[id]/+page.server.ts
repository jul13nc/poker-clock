import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getParticipants, getTournament } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { formatEuro } from '#lib/domain/format';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) error(404, 'Tournoi introuvable.');

	const participants = await getParticipants(db, params.id);
	const entries = participants.reduce((sum, participant) => sum + participant.entries, 0);

	return {
		tournament,
		participants,
		totals: {
			entries,
			players: participants.length,
			pool: tournament.buy_in * entries,
			poolLabel: formatEuro(tournament.buy_in * entries)
		}
	};
};

export const actions: Actions = {
	delete: async ({ params, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const db = getDb(platform);
		await db.batch([
			db.prepare('DELETE FROM hands_72 WHERE tournament_id = ?').bind(params.id),
			db.prepare('DELETE FROM tournament_players WHERE tournament_id = ?').bind(params.id),
			db.prepare('DELETE FROM tournaments WHERE id = ?').bind(params.id)
		]);
		throw redirect(303, '/tournois');
	}
};
