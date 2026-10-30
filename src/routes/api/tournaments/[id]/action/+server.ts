import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildTournamentState, getTournament, parseLevels } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { queryAll, queryOne } from '#lib/server/db';
import {
	cancelLastElimination,
	eliminatePlayer,
	reinstatePlayer
} from '#lib/server/eliminations';
import { drawSeats, secureRandom } from '#lib/domain/seats';
import {
	addTime,
	nextLevel,
	pauseClock,
	previousLevel,
	resumeClock,
	startClock
} from '#lib/domain/clock';
import type { ClockState } from '#lib/domain/types';

type ActionBody = {
	action?: string;
	playerId?: string;
	minutes?: number;
};

const CLOCK_ACTIONS = new Set(['start', 'pause', 'resume', 'next', 'prev', 'add_time']);

/** Actions qui modifient le déroulé et n'ont plus de sens après la clôture. */
const LOCKED_ACTIONS = new Set([
	...CLOCK_ACTIONS,
	'rebuy',
	'unrebuy',
	'eliminate',
	'cancel_elimination',
	'draw_seats'
]);

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!locals.isAdmin) {
		return json({ error: 'Action réservée à l’organisateur.' }, { status: 401 });
	}

	const db = getDb(platform);
	const tournament = await getTournament(db, params.id);
	if (!tournament) {
		return json({ error: 'Tournoi introuvable.' }, { status: 404 });
	}

	let body: ActionBody;
	try {
		body = (await request.json()) as ActionBody;
	} catch {
		return json({ error: 'Requête invalide.' }, { status: 400 });
	}

	const action = body.action ?? '';
	const now = Date.now();
	const levels = parseLevels(tournament.structure_json);
	let clock: ClockState | null = tournament.clock_json
		? (JSON.parse(tournament.clock_json) as ClockState)
		: null;
	let status = tournament.status;

	if (tournament.status === 'finished' && LOCKED_ACTIONS.has(action)) {
		return json({ error: 'Ce tournoi est déjà clôturé.' }, { status: 409 });
	}

	switch (action) {
		case 'start':
			if (!clock) {
				clock = startClock(now);
				status = 'running';
			}
			break;

		case 'pause':
			clock = pauseClock(clock, now);
			break;

		case 'resume':
			clock = resumeClock(clock, now);
			break;

		case 'next':
			clock = nextLevel(levels, clock, now);
			break;

		case 'prev':
			clock = previousLevel(levels, clock, now);
			break;

		case 'add_time': {
			const minutes = Math.max(1, Math.min(60, Math.round(Number(body.minutes) || 1)));
			clock = addTime(clock, minutes * 60_000);
			break;
		}

		case 'rebuy':
		case 'unrebuy': {
			if (!body.playerId) {
				return json({ error: 'Joueur manquant.' }, { status: 400 });
			}
			const participant = await queryOne<{ entries: number; finish_rank: number | null }>(
				db,
				'SELECT entries, finish_rank FROM tournament_players WHERE tournament_id = ? AND player_id = ?',
				params.id,
				body.playerId
			);
			if (!participant) {
				return json({ error: 'Joueur absent de ce tournoi.' }, { status: 404 });
			}
			const delta = action === 'rebuy' ? 1 : -1;
			await db
				.prepare(
					`UPDATE tournament_players
					 SET entries = MAX(1, entries + ?)
					 WHERE tournament_id = ? AND player_id = ?`
				)
				.bind(delta, params.id, body.playerId)
				.run();
			// Une recave sur un joueur éliminé le remet en jeu.
			if (action === 'rebuy' && participant.finish_rank !== null) {
				await reinstatePlayer(db, params.id, body.playerId);
			}
			break;
		}

		case 'eliminate': {
			if (!body.playerId) {
				return json({ error: 'Joueur manquant.' }, { status: 400 });
			}
			const failure = await eliminatePlayer(db, params.id, body.playerId);
			if (failure) return json({ error: failure }, { status: 409 });
			break;
		}

		case 'cancel_elimination': {
			const failure = await cancelLastElimination(db, params.id);
			if (failure) return json({ error: failure }, { status: 409 });
			break;
		}

		case 'draw_seats': {
			const players = await queryAll<{ player_id: string }>(
				db,
				'SELECT player_id FROM tournament_players WHERE tournament_id = ?',
				params.id
			);
			if (players.length === 0) {
				return json({ error: 'Aucun joueur dans ce tournoi.' }, { status: 400 });
			}

			const assignments = drawSeats(
				players.map((player) => player.player_id),
				secureRandom
			);
			await db.batch(
				assignments.map((assignment) =>
					db
						.prepare(
							`UPDATE tournament_players SET seat = ?
							 WHERE tournament_id = ? AND player_id = ?`
						)
						.bind(assignment.seat, params.id, assignment.playerId)
				)
			);
			break;
		}

		case 'hand72_add': {
			if (!body.playerId) {
				return json({ error: 'Joueur manquant.' }, { status: 400 });
			}
			await db
				.prepare(
					'INSERT INTO hands_72 (id, tournament_id, player_id, count) VALUES (?, ?, ?, 1)'
				)
				.bind(crypto.randomUUID(), params.id, body.playerId)
				.run();
			break;
		}

		case 'hand72_remove': {
			if (!body.playerId) {
				return json({ error: 'Joueur manquant.' }, { status: 400 });
			}
			await db
				.prepare(
					`DELETE FROM hands_72
					 WHERE id = (
					   SELECT id FROM hands_72
					   WHERE tournament_id = ? AND player_id = ?
					   ORDER BY created_at DESC, id DESC
					   LIMIT 1
					 )`
				)
				.bind(params.id, body.playerId)
				.run();
			break;
		}

		default:
			return json({ error: 'Action inconnue.' }, { status: 400 });
	}

	if (CLOCK_ACTIONS.has(action)) {
		await db
			.prepare('UPDATE tournaments SET clock_json = ?, status = ? WHERE id = ?')
			.bind(JSON.stringify(clock), status, params.id)
			.run();
	}

	const state = await buildTournamentState(db, params.id);
	return json(
		{ ...state, serverNow: Date.now() },
		{ headers: { 'cache-control': 'no-store' } }
	);
};
