import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getParticipants, getTournament } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { buildWhatsappText } from '#lib/domain/share';

export const GET: RequestHandler = async ({ params, platform }) => {
	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) error(404, 'Tournoi introuvable.');

	const participants = await getParticipants(db, params.id);
	const text = buildWhatsappText(tournament, participants);

	return new Response(text, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
