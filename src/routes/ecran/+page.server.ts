import type { PageServerLoad } from './$types';
import { buildCurrentTournamentState } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const ssr = false;

export const load: PageServerLoad = async ({ platform, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return { state: await buildCurrentTournamentState(getDb(platform)) };
};
