import type { PageServerLoad } from './$types';
import { ensureSeason, listTournaments } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);
	const tournaments = await listTournaments(db, season.id);
	return { tournaments, season };
};
