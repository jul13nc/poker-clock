import { expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { testDb } from './test-db';
import { stateResponse } from './state-response';

it('ETag évite participants/calcul inchangés et invalide après modification de saison', async () => {
	const { db, sqlite } = testDb();
	sqlite.exec(`INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30');
	INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 't','s','T','2026-10-30',levels_json FROM blind_structures;`);
	const spy = vi.spyOn(db, 'prepare');
	const first = await stateResponse(db, new Request('http://local/state'));
	expect(first.status).toBe(200);
	expect(spy).toHaveBeenCalledTimes(3);
	spy.mockClear();
	const second = await stateResponse(db, new Request('http://local/state', { headers: { 'if-none-match': first.headers.get('etag')! } }));
	expect(second.status).toBe(304);
	expect(await second.text()).toBe('');
	expect(spy).toHaveBeenCalledTimes(1);
	sqlite.exec("UPDATE seasons SET name='Changed' WHERE id='s'");
	const third = await stateResponse(db, new Request('http://local/state', { headers: { 'if-none-match': first.headers.get('etag')! } }));
	expect(third.status).toBe(200);
	expect((await third.json()).state.seasonName).toBe('Changed');
});
