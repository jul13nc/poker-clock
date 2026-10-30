import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildCurrentTournamentState } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const GET: RequestHandler = async ({ platform }) => {
	const state = await buildCurrentTournamentState(getDb(platform));
	return json(
		{ state, serverNow: Date.now() },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
