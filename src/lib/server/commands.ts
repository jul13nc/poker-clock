import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type { CommandMeta, TournamentCommand } from '#lib/domain/commands';
import type { ClockState } from '#lib/domain/types';
import { addTime, nextLevel, previousLevel, pauseClock, resumeClock, startClock } from '#lib/domain/clock';
import { drawSeats, secureRandom } from '#lib/domain/seats';
import { getParticipants, getTournament, parseLevels } from './data';

export class CommandError extends Error {
	constructor(message: string, public status = 409) { super(message); }
}

export async function replayed(db: D1Database, id: string, meta: CommandMeta, payload: string) {
	const previous = await db.prepare('SELECT payload FROM tournament_commands WHERE tournament_id = ? AND command_id = ?')
		.bind(id, meta.commandId).first<{ payload: string }>();
	if (previous && previous.payload !== payload) throw new CommandError('Identifiant de commande déjà utilisé pour une autre action.');
	return !!previous;
}

/** Le garde de révision et toutes les mutations sont dans une transaction D1. */
export async function commitCommand(db: D1Database, id: string, meta: CommandMeta, payload: string, statements: D1PreparedStatement[]) {
	try {
		await db.batch([
			db.prepare('INSERT INTO tournament_commands (tournament_id, command_id, expected_revision, payload, created_at) VALUES (?, ?, ?, ?, ?)')
				.bind(id, meta.commandId, meta.expectedRevision, payload, Date.now()),
			...statements,
			db.prepare('UPDATE tournaments SET revision = revision + 1 WHERE id = ?').bind(id)
		]);
	} catch (error) {
		if (await replayed(db, id, meta, payload)) return;
		const message = String(error);
		if (message.includes('revision_conflict')) throw new CommandError('État modifié depuis votre dernière lecture. Resynchronisez puis réessayez.');
		if (message.includes('tournaments.status')) throw new CommandError('Une autre partie est déjà en cours.');
		throw error;
	}
}

export async function executeCommand(db: D1Database, id: string, command: TournamentCommand, now = Date.now()) {
	const payload = JSON.stringify(command);
	if (await replayed(db, id, command, payload)) return;
	const tournament = await getTournament(db, id);
	if (!tournament) throw new CommandError('Tournoi introuvable.', 404);
	if (tournament.revision !== command.expectedRevision) throw new CommandError('État modifié. Resynchronisez puis réessayez.');
	if (tournament.status === 'finished' && !command.action.startsWith('hand72_')) throw new CommandError('Ce tournoi est déjà clôturé.');
	const players = await getParticipants(db, id);
	const player = 'playerId' in command ? players.find((p) => p.player_id === command.playerId) : null;
	if ('playerId' in command && !player) throw new CommandError('Joueur absent de ce tournoi.', 404);
	const statements: D1PreparedStatement[] = [];
	const levels = parseLevels(tournament.structure_json);
	let clock: ClockState | null = tournament.clock_json ? JSON.parse(tournament.clock_json) : null;
	let status = tournament.status;
	const writePlayer = (playerId: string, rank: number | null, eliminated: string | null) =>
		db.prepare('UPDATE tournament_players SET finish_rank = ?, eliminated_at = ? WHERE tournament_id = ? AND player_id = ?').bind(rank, eliminated, id, playerId);
	switch (command.action) {
		case 'start': if (!clock) { clock = startClock(now); status = 'running'; } break;
		case 'pause': clock = pauseClock(clock, now); break;
		case 'resume': clock = resumeClock(clock, now); break;
		case 'next': clock = nextLevel(levels, clock, now); break;
		case 'prev': clock = previousLevel(levels, clock, now); break;
		case 'add_time': clock = addTime(clock, command.minutes * 60_000); break;
		case 'set_rebuy_duration': statements.push(db.prepare('UPDATE tournaments SET rebuy_duration = ? WHERE id = ?').bind(command.minutes, id)); break;
		case 'rebuy':
		case 'unrebuy': {
			const delta = command.action === 'rebuy' ? 1 : -1;
			statements.push(db.prepare(`UPDATE tournament_players SET entries = MAX(1, entries + ?),
				rebuy_order = CASE WHEN ? = 1 AND entries = 1 THEN
				(SELECT COALESCE(MAX(rebuy_order), 0) + 1 FROM tournament_players WHERE tournament_id = ?)
				WHEN ? = -1 AND entries <= 2 THEN NULL ELSE rebuy_order END
				WHERE tournament_id = ? AND player_id = ?`).bind(delta, delta, id, delta, id, command.playerId));
			if (delta === 1 && player!.finish_rank !== null) {
				statements.push(writePlayer(command.playerId, null, null));
				const others = players.filter((p) => p.player_id !== command.playerId && p.finish_rank !== null)
					.sort((a, b) => (a.eliminated_at ?? '').localeCompare(b.eliminated_at ?? '') || b.finish_rank! - a.finish_rank! || a.player_id.localeCompare(b.player_id));
				others.forEach((p, index) => statements.push(writePlayer(p.player_id, players.length - index, p.eliminated_at)));
			}
			break;
		}
		case 'eliminate': {
			const remaining = players.filter((p) => p.finish_rank === null).length;
			if (player!.finish_rank !== null || remaining <= 1) throw new CommandError('Élimination impossible : joueur déjà éliminé ou dernier survivant.');
			statements.push(writePlayer(command.playerId, remaining, new Date(now).toISOString())); break;
		}
		case 'cancel_elimination': {
			const last = players.filter((p) => p.finish_rank !== null).sort((a, b) => a.finish_rank! - b.finish_rank!)[0];
			if (!last) throw new CommandError('Aucune élimination à annuler.');
			statements.push(writePlayer(last.player_id, null, null)); break;
		}
		case 'draw_seats':
			for (const seat of drawSeats(players.map((p) => p.player_id), secureRandom)) statements.push(db.prepare('UPDATE tournament_players SET seat = ? WHERE tournament_id = ? AND player_id = ?').bind(seat.seat, id, seat.playerId));
			break;
		case 'hand72_add': statements.push(db.prepare('INSERT INTO hands_72 (id, tournament_id, player_id, count) VALUES (?, ?, ?, 1)').bind(crypto.randomUUID(), id, command.playerId)); break;
		case 'hand72_remove': statements.push(db.prepare(`DELETE FROM hands_72 WHERE id = (SELECT id FROM hands_72 WHERE tournament_id = ? AND player_id = ? ORDER BY created_at DESC, id DESC LIMIT 1)`).bind(id, command.playerId)); break;
	}
	if (['start', 'pause', 'resume', 'next', 'prev', 'add_time'].includes(command.action)) statements.push(db.prepare('UPDATE tournaments SET clock_json = ?, status = ? WHERE id = ?').bind(clock ? JSON.stringify(clock) : null, status, id));
	await commitCommand(db, id, command, payload, statements);
}
