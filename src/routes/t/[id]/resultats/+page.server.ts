import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getParticipants, getTournament } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) error(404, 'Tournoi introuvable.');
	const participants = await getParticipants(db, params.id);
	return { tournament, participants };
};
