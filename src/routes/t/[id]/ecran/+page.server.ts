import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { buildTournamentState } from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const ssr = false;

export const load: PageServerLoad = async ({ params, platform }) => {
	const state = await buildTournamentState(getDb(platform), params.id);
	if (!state) error(404, 'Tournoi introuvable.');
	return { state };
};
