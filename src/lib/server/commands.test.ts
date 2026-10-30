import { describe, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { testDb } from './test-db';
import { commitCommand, executeCommand } from './commands';
import { parseCommand, type TournamentCommand } from '#lib/domain/commands';
import { computeClock, rebuyRemainingMs } from '#lib/domain/clock';
import { buildTournamentState } from './data';

function setup() {
	const result = testDb();
	result.sqlite.exec(`INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30');
	INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 't','s','T','2026-10-30',levels_json FROM blind_structures;
	INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 'u','s','U','2026-10-30',levels_json FROM blind_structures;`);
	for (const id of ['a','b','c']) {
		result.sqlite.prepare('INSERT INTO players(id,name) VALUES (?,?)').run(id,id);
		result.sqlite.prepare("INSERT INTO tournament_players(tournament_id,player_id) VALUES ('t',?)").run(id);
	}
	return result;
}
const command = (action: string, revision: number, extra = {}) => ({ action, expectedRevision: revision, commandId: crypto.randomUUID(), ...extra }) as TournamentCommand;

describe('commandes transactionnelles', () => {
	it('persiste −1 minute et synchronise blindes et recaves sur état API', async () => {
		const { db } = setup();
		await executeCommand(db, 't', command('start', 0), 1000);
		await executeCommand(db, 't', command('pause', 1), 601000);
		await executeCommand(db, 't', command('add_time', 2, { minutes: -1 }), 901000);
		const state = (await buildTournamentState(db, 't'))!;
		expect(computeClock(state.levels, state.clock, 1201000).remainingMs).toBe(4 * 60_000);
		expect(rebuyRemainingMs(state.rebuyDuration, state.clock, 1201000)).toBe(79 * 60_000);
	});
	it('rejette JSON malformé et champs invalides', () => {
		for (const value of [null, [], {}, command('unknown', 0), command('rebuy', 0, { playerId: 2 }), command('add_time', 0, { minutes: 0 })]) expect(parseCommand(value)).toBeNull();
		expect(parseCommand(command('pause', 0))).not.toBeNull();
		expect(parseCommand(command('add_time', 0, { minutes: -1 }))).not.toBeNull();
		for (const minutes of [-61, 61, 0, 0.5]) expect(parseCommand(command('add_time', 0, { minutes }))).toBeNull();
		expect(parseCommand(command('set_rebuy_duration', 0, { minutes: -1 }))).toBeNull();
	});
	it('détecte deux commandes calculées sur la même révision sans perdre la première', async () => {
		const { db, sqlite } = setup();
		await executeCommand(db, 't', command('start', 0), 1000);
		await executeCommand(db, 't', command('add_time', 1, { minutes: 1 }), 2000);
		await expect(executeCommand(db, 't', command('pause', 1), 2000)).rejects.toThrow('État modifié');
		expect(JSON.parse(String(sqlite.prepare("SELECT clock_json FROM tournaments WHERE id='t'").get()!.clock_json)).offsetMs).toBe(-60_000);
	});
	it('le garde SQL annule un batch complet après une modification concurrente', async () => {
		const { db, sqlite } = setup();
		await executeCommand(db, 't', command('start', 0));
		await expect(commitCommand(db, 't', command('pause', 0), 'stale', [db.prepare("UPDATE tournament_players SET entries=99 WHERE tournament_id='t'")])).rejects.toThrow('Resynchronisez');
		expect(sqlite.prepare('SELECT MAX(entries) AS n FROM tournament_players').get()!.n).toBe(1);
	});
	it('un ID rejoué ne double pas la recave et un autre payload est refusé', async () => {
		const { db, sqlite } = setup();
		const input = command('rebuy', 0, { playerId: 'a' });
		await executeCommand(db, 't', input);
		await executeCommand(db, 't', input);
		expect(sqlite.prepare("SELECT entries FROM tournament_players WHERE player_id='a'").get()!.entries).toBe(2);
		await expect(executeCommand(db, 't', { ...input, action: 'pause' })).rejects.toThrow('autre action');
	});
	it('une seule partie peut démarrer, y compris entre deux saisons', async () => {
		const { db } = setup();
		await executeCommand(db, 't', command('start', 0));
		await expect(executeCommand(db, 'u', command('start', 0))).rejects.toThrow('autre partie');
	});
	it('recave et réintégration renumérotent les places et gardent premier numéro', async () => {
		const { db, sqlite } = setup();
		await executeCommand(db, 't', command('eliminate', 0, { playerId: 'a' }));
		await executeCommand(db, 't', command('eliminate', 1, { playerId: 'b' }));
		await executeCommand(db, 't', command('rebuy', 2, { playerId: 'a' }));
		await executeCommand(db, 't', command('rebuy', 3, { playerId: 'a' }));
		expect(sqlite.prepare("SELECT entries,rebuy_order,finish_rank FROM tournament_players WHERE player_id='a'").get()).toMatchObject({ entries: 3, rebuy_order: 1, finish_rank: null });
		expect(sqlite.prepare("SELECT finish_rank FROM tournament_players WHERE player_id='b'").get()!.finish_rank).toBe(3);
		await executeCommand(db, 't', command('unrebuy', 4, { playerId: 'a' }));
		await executeCommand(db, 't', command('unrebuy', 5, { playerId: 'a' }));
		expect(sqlite.prepare("SELECT rebuy_order FROM tournament_players WHERE player_id='a'").get()!.rebuy_order).toBeNull();
	});
	it('rollback de toutes les écritures si une instruction intermédiaire échoue', async () => {
		const { db, sqlite } = setup();
		await expect(commitCommand(db, 't', command('pause', 0), 'failure', [
			db.prepare("UPDATE tournament_players SET entries=2 WHERE player_id='a'"),
			db.prepare("INSERT INTO players(id,name) VALUES ('a','duplicate')")
		])).rejects.toThrow();
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM tournament_commands').get()!.n).toBe(0);
		expect(sqlite.prepare("SELECT entries FROM tournament_players WHERE player_id='a'").get()!.entries).toBe(1);
	});
	it('refuse une main 7-2 sur joueur absent du tournoi', async () => {
		const { db } = setup();
		await expect(executeCommand(db, 'u', command('hand72_add', 0, { playerId: 'a' }))).rejects.toThrow('absent');
	});
});
