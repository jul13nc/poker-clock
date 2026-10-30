import type { LayoutServerLoad } from './$types';
import { ensureSeason } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: LayoutServerLoad = async ({ platform, locals, url }) => {
	if (/^\/ecran\/?$/.test(url.pathname) || /^\/t\/[^/]+\/ecran\/?$/.test(url.pathname)) return { season: null, isAdmin: locals.isAdmin };
	const db = getDb(platform);
	const season = await ensureSeason(db);
	return {
		season,
		isAdmin: locals.isAdmin
	};
};
