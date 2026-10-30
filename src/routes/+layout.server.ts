import type { LayoutServerLoad } from './$types';
import { ensureSeason } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: LayoutServerLoad = async ({ platform, locals }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);
	return {
		season,
		isAdmin: locals.isAdmin
	};
};
