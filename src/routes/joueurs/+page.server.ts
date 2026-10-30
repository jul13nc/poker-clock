import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ensureSeason,
	getStandings72,
	getStandingsPoints,
	insertPlayer,
	listPlayers,
	togglePlayer
} from '#lib/server/data';
import { getDb } from '#lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);
	const [players, points, hands] = await Promise.all([
		listPlayers(db),
		getStandingsPoints(db, season.id),
		getStandings72(db, season.id)
	]);

	const pointsById = new Map(points.map((row) => [row.id, row]));
	const handsById = new Map(hands.map((row) => [row.id, row]));

	return {
		players: players.map((player) => ({
			...player,
			points: pointsById.get(player.id)?.points ?? 0,
			played: pointsById.get(player.id)?.played ?? 0,
			hands72: handsById.get(player.id)?.hands ?? 0
		}))
	};
};

export const actions: Actions = {
	add: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();

		if (name.length < 2 || name.length > 40) {
			return fail(400, { error: 'Le nom doit faire entre 2 et 40 caractères.' });
		}

		try {
			await insertPlayer(getDb(platform), name);
		} catch {
			return fail(400, { error: 'Ce joueur existe déjà.' });
		}

		return { success: `${name} a été ajouté.` };
	},

	toggle: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'Joueur introuvable.' });
		await togglePlayer(getDb(platform), id);
		return { success: 'Joueur mis à jour.' };
	}
};
