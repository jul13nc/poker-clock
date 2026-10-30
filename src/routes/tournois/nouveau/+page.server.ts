import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	ensureSeason,
	listActivePlayers,
	listStructures,
	parseLevels
} from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { totalDurationMs } from '#lib/domain/clock';
import { DEFAULT_REBUY_DURATION } from '#lib/domain/defaults';
import { validateBlindLevels } from '#lib/domain/blinds';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.isAdmin) throw redirect(303, '/admin');
	const db = getDb(platform);
	const season = await ensureSeason(db);
	const [players, structures] = await Promise.all([
		listActivePlayers(db),
		listStructures(db)
	]);

	return {
		season,
		players,
		today: new Date().toISOString().slice(0, 10),
		structures: structures.map((structure) => {
			const levels = parseLevels(structure.levels_json);
			return {
				id: structure.id,
				name: structure.name,
				levelCount: levels.length,
				totalMinutes: Math.round(totalDurationMs(levels) / 60000)
			};
		})
	};
};

export const actions: Actions = {
	create: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const db = getDb(platform);
		const season = await ensureSeason(db);
		const form = await request.formData();

		const name = String(form.get('name') ?? '').trim();
		const playedAt = String(form.get('played_at') ?? '');
		const buyIn = Number(form.get('buy_in'));
		const startingStack = Number(form.get('starting_stack'));
		const rebuyDuration = Number(form.get('rebuy_duration') ?? DEFAULT_REBUY_DURATION);
		const multiplier = Number(form.get('multiplier'));
		const structureId = String(form.get('structure_id') ?? '');
		const playerIds = [...new Set(form.getAll('players').map(String))];

		if (name.length < 2 || name.length > 80) {
			return fail(400, { error: 'Le nom du tournoi doit faire entre 2 et 80 caractères.' });
		}
		if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) {
			return fail(400, { error: 'Date invalide.' });
		}
		if (!Number.isFinite(buyIn) || buyIn < 0) {
			return fail(400, { error: 'Buy-in invalide.' });
		}
		if (!Number.isFinite(startingStack) || startingStack <= 0) {
			return fail(400, { error: 'Tapis de départ invalide.' });
		}
		if (multiplier !== 1 && multiplier !== 2) {
			return fail(400, { error: 'Multiplicateur invalide.' });
		}
		if (!Number.isSafeInteger(rebuyDuration) || rebuyDuration < 0) {
			return fail(400, { error: 'La durée des recaves doit être un nombre entier positif ou nul.' });
		}
		if (playerIds.length < 2) {
			return fail(400, { error: 'Sélectionnez au moins deux joueurs.' });
		}
		const active = new Set((await listActivePlayers(db)).map((player) => player.id));
		if (playerIds.some((id) => !active.has(id))) return fail(400, { error: 'Joueur absent ou inactif.' });

		const structures = await listStructures(db);
		const structure = structureId ? structures.find((entry) => entry.id === structureId) : structures[0];
		if (!structure) {
			return fail(400, { error: 'Aucune structure de blindes disponible.' });
		}
		const levels = validateBlindLevels(parseLevels(structure.levels_json));
		if (!levels) return fail(400, { error: 'Structure invalide : corrigez ses niveaux depuis la page Blindes (sans ante ni pause).' });

		const id = crypto.randomUUID();
		const insert = db
			.prepare(
				`INSERT INTO tournaments
				 (id, season_id, name, played_at, status, multiplier, buy_in, starting_stack, rebuy_duration, structure_json)
				 VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
			)
			.bind(
				id,
				season.id,
				name,
				playedAt,
				multiplier,
				buyIn,
				Math.round(startingStack),
				rebuyDuration,
				JSON.stringify(levels)
			);

		await db.batch([
			insert,
			...playerIds.map((playerId) =>
				db
					.prepare(
						'INSERT INTO tournament_players (tournament_id, player_id) VALUES (?, ?)'
					)
					.bind(id, playerId)
			)
		]);

		throw redirect(303, `/t/${id}/controle`);
	}
};
