import { describe, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('$app/env', () => ({ dev: true }));
import { login, revokeSession, verifyAdminToken } from './auth';
import { testDb } from './test-db';

const env = { ADMIN_PIN: '987654', SESSION_SECRET: 'a-secret-with-at-least-32-characters' };
describe('sessions organisateur', () => {
	it('refuse configuration absente, ancien jeton et PIN erroné', async () => {
		const { db } = testDb();
		expect(await login(db, '1234', 'ip', {})).toMatchObject({ status: 503 });
		expect(await login(db, 'wrong', 'ip', env)).toMatchObject({ status: 401 });
		expect(await verifyAdminToken(db, 'old-static-signature', env)).toBe(false);
	});
	it('crée sessions distinctes, expire côté serveur et révoque à la déconnexion', async () => {
		const { db } = testDb();
		const first = await login(db, env.ADMIN_PIN, 'ip', env, 1000);
		const second = await login(db, env.ADMIN_PIN, 'ip', env, 1000);
		if (!('token' in first) || !('token' in second)) throw new Error('Connexion refusée');
		expect(first.token).not.toBe(second.token);
		expect(await verifyAdminToken(db, first.token, env, 1001)).toBe(true);
		expect(await verifyAdminToken(db, first.token + 'x', env, 1001)).toBe(false);
		expect(await verifyAdminToken(db, first.token, env, 1000 + 7 * 86400_000)).toBe(false);
		await revokeSession(db, second.token, env);
		expect(await verifyAdminToken(db, second.token, env, 1001)).toBe(false);
	});
	it('limite les tentatives dans stockage partagé et réouvre après expiration', async () => {
		const { db } = testDb();
		for (let i = 0; i < 10; i++) await login(db, 'wrong', 'same-ip', env, 1000);
		expect(await login(db, env.ADMIN_PIN, 'same-ip', env, 1001)).toMatchObject({ status: 429 });
		expect(await login(db, env.ADMIN_PIN, 'same-ip', env, 1000 + 15 * 60_000)).toHaveProperty('token');
	});
});
