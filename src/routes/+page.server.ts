import type { PageServerLoad } from './$types';
import {
	ensureSeason,
	getStandings72,
	getStandingsPoints,
	listTournaments
} from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);

	const [points, hands, tournaments] = await Promise.all([
		getStandingsPoints(db, season.id),
		getStandings72(db, season.id),
		listTournaments(db, season.id)
	]);

	const finished = tournaments.filter((tournament) => tournament.status === 'finished');
	const totalEntries = finished.reduce((sum, tournament) => sum + tournament.entries_count, 0);
	const totalPool = finished.reduce(
		(sum, tournament) => sum + tournament.buy_in * tournament.entries_count,
		0
	);

	return {
		points: points.slice(0, 5),
		hands: hands.slice(0, 5),
		tournaments: tournaments.slice(0, 6),
		stats: {
			finished: finished.length,
			players: points.length,
			entries: totalEntries,
			totalPool,
			hands72: hands.reduce((sum, player) => sum + player.hands, 0)
		}
	};
};
