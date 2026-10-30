import { expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { testDb } from './test-db';
import { getStandingsPoints, getStandingsPointsExcluding } from './data';

it('classement actuel inclut leader absent, soirées ultérieures et ex æquo', async () => {
	const { db, sqlite } = testDb();
	sqlite.exec(`INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30');
	INSERT INTO players(id,name) VALUES ('leader','Leader absent'),('a','Alice'),('b','Bob');
	INSERT INTO tournaments(id,season_id,name,played_at,structure_json,status) VALUES
	('old','s','Ancien','2026-10-01','[]','finished'),('new','s','Suivant','2026-10-30','[]','finished');
	INSERT INTO tournament_players(tournament_id,player_id,finish_rank,points) VALUES
	('old','a',1,10),('old','b',2,10),('new','leader',1,20);`);
	expect((await getStandingsPoints(db, 's')).map((p) => [p.id, p.rank, p.points])).toEqual([
		['leader', 1, 20], ['a', 2, 10], ['b', 2, 10]
	]);
	expect((await getStandingsPointsExcluding(db, 's', 'old')).map((p) => p.id)).toEqual(['leader']);
});
