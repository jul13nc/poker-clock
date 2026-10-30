import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildTournamentState } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const GET: RequestHandler = async ({ params, platform }) => {
	const state = await buildTournamentState(getDb(platform), params.id);
	if (!state) return json({ error: 'Tournoi introuvable.' }, { status: 404 });
	return json(
		{ ...state, serverNow: Date.now() },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
