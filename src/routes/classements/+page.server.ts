import type { PageServerLoad } from './$types';
import { ensureSeason, getStandings72, getStandingsPoints, parseJsonNumberList } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { DEFAULT_POINTS_SCALE } from '#lib/domain/points';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);
	const [points, hands] = await Promise.all([
		getStandingsPoints(db, season.id),
		getStandings72(db, season.id)
	]);

	return {
		points,
		hands,
		scale: parseJsonNumberList(season.points_scale_json, DEFAULT_POINTS_SCALE),
		rebuyRule: season.rebuy_rule,
		seasonName: season.name
	};
};
