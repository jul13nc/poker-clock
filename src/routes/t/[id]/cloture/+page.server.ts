import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getParticipants,
	getTournament,
	parseJsonNumberList
} from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { assignPoints, DEFAULT_POINTS_SCALE } from '#lib/domain/points';
import { computePayouts, parsePayoutTableJson } from '#lib/domain/payout';
import { DEFAULT_PAYOUT_TABLE } from '#lib/domain/defaults';
import { CommandError, commitCommand, replayed } from '#lib/server/commands';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
	if (!locals.isAdmin) throw redirect(303, '/admin');
	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) error(404, 'Tournoi introuvable.');
	const participants = await getParticipants(db, params.id);
	return { tournament, participants, commandId: crypto.randomUUID() };
};

export const actions: Actions = {
	close: async ({ params, request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const db = getDb(platform);
		const tournament = await getTournament(db, params.id);
		if (!tournament) return fail(404, { error: 'Tournoi introuvable.' });

		const participants = await getParticipants(db, params.id);
		const count = participants.length;
		if (count === 0) return fail(400, { error: 'Aucun participant.' });

		const form = await request.formData();
		const meta = { commandId: String(form.get('command_id') ?? ''), expectedRevision: Number(form.get('revision')) };
		if (!/^[\w-]{16,100}$/.test(meta.commandId) || !Number.isSafeInteger(meta.expectedRevision) || meta.expectedRevision < 0) return fail(400, { error: 'Commande de clôture invalide.' });
		const payload = JSON.stringify({ action: 'close', ranks: [...form.entries()].filter(([key]) => key.startsWith('rank_')).sort(([a], [b]) => a.localeCompare(b)) });
		try {
			if (await replayed(db, params.id, meta, payload)) throw redirect(303, `/t/${params.id}/resultats`);
		} catch (error) {
			if (error instanceof CommandError) return fail(error.status, { error: error.message });
			throw error;
		}
		const rankById = new Map<string, number>();

		for (const participant of participants) {
			const value = Number(form.get(`rank_${participant.player_id}`));
			if (!Number.isInteger(value) || value < 1 || value > count) {
				return fail(400, { error: 'Classement incomplet ou invalide.' });
			}
			rankById.set(participant.player_id, value);
		}

		if (new Set(rankById.values()).size !== count) {
			return fail(400, { error: 'Deux joueurs ne peuvent pas occuper la même place.' });
		}

		const scale = parseJsonNumberList(tournament.points_scale_json, DEFAULT_POINTS_SCALE);
		const table = parsePayoutTableJson(tournament.payout_json, DEFAULT_PAYOUT_TABLE);

		const assignments = assignPoints(
			participants.map((participant) => ({
				playerId: participant.player_id,
				entries: participant.entries,
				rebuyOrder: participant.rebuy_order,
				finishRank: rankById.get(participant.player_id) ?? 0
			})),
			scale,
			tournament.multiplier,
			tournament.rebuy_rule
		);
		const assignmentById = new Map(assignments.map((entry) => [entry.playerId, entry]));

		const totalEntries = participants.reduce((sum, participant) => sum + participant.entries, 0);
		const payouts = computePayouts(count, totalEntries, tournament.buy_in, table);
		const prizeByPlace = new Map(payouts.map((line) => [line.place, line.amount]));

		const statements = participants.map((participant) => {
			const rank = rankById.get(participant.player_id) ?? count;
			const assignment = assignmentById.get(participant.player_id);
			return db
				.prepare(
					`UPDATE tournament_players
					 SET finish_rank = ?, points = ?, points_rank = ?, prize = ?
					 WHERE tournament_id = ? AND player_id = ?`
				)
				.bind(
					rank,
					assignment?.points ?? 0,
					assignment?.pointsRank ?? rank,
					prizeByPlace.get(rank) ?? 0,
					params.id,
					participant.player_id
				);
		});

		statements.push(
			db.prepare("UPDATE tournaments SET status = 'finished' WHERE id = ?").bind(params.id)
		);
		try { await commitCommand(db, params.id, meta, payload, statements); }
		catch (error) {
			if (error instanceof CommandError) return fail(error.status, { error: error.message });
			throw error;
		}

		throw redirect(303, `/t/${params.id}/resultats`);
	}
};
