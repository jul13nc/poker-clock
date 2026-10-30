import { describe, expect, it } from 'vitest';
import { testDb } from './test-db';

describe('migrations', () => {
	it('initialise sessions, commandes et révision avec les migrations disponibles', () => {
		const { sqlite } = testDb();
		sqlite.exec("INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30'); INSERT INTO tournaments(id,season_id,name,played_at,structure_json) VALUES ('t','s','T','2026-10-30','[]');");
		expect(sqlite.prepare('SELECT id,revision FROM tournaments').get()).toMatchObject({ id: 't', revision: 0 });
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM admin_sessions').get()!.n).toBe(0);
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM login_attempts').get()!.n).toBe(0);
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM tournament_commands').get()!.n).toBe(0);
	});
	it('refuse plusieurs tournois running sans décider lequel terminer', () => {
		const { sqlite } = testDb();
		sqlite.exec("INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30'); INSERT INTO tournaments(id,season_id,name,played_at,structure_json,status) VALUES ('t','s','T','2026-10-30','[]','running');");
		expect(() => sqlite.exec("INSERT INTO tournaments(id,season_id,name,played_at,structure_json,status) VALUES ('u','s','U','2026-10-30','[]','running')")).toThrow();
		expect(sqlite.prepare("SELECT id FROM tournaments WHERE status='running'").get()!.id).toBe('t');
	});
	it('toutes nouvelles migrations fonctionnent sur base neuve', () => {
		const { sqlite } = testDb();
		expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
		expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='command_revision_guard'").get()).toBeTruthy();
	});
});
