import { env as workerEnv } from 'cloudflare:workers';
import { dev } from '$app/env';
import type { Cookies } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';

const COOKIE_NAME = 'pc_admin';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;
type RuntimeEnv = { ADMIN_PIN?: string; SESSION_SECRET?: string };

function configuration(override?: RuntimeEnv): RuntimeEnv {
	return override ?? workerEnv;
}

async function digest(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const result = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
	return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function login(
	db: D1Database, pin: string, address: string, override?: RuntimeEnv, now = Date.now()
): Promise<{ token: string } | { error: string; status: 401 | 429 | 503 }> {
	const env = configuration(override);
	if (!env.ADMIN_PIN || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
		return { error: 'Authentification non configurée : ADMIN_PIN et SESSION_SECRET (32 caractères minimum) requis.', status: 503 };
	}
	// D1 est partagé entre les instances ; aucune adresse brute n'est conservée.
	const bucket = await digest(`login:${address}`, env.SESSION_SECRET);
	const attempt = await db.prepare(`INSERT INTO login_attempts (bucket, attempts, expires_at)
		VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET
		attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END,
		expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
		RETURNING attempts`).bind(bucket, now + WINDOW_MS, now, now).first<{ attempts: number }>();
	if (!attempt || attempt.attempts > MAX_ATTEMPTS) {
		return { error: 'Trop de tentatives. Réessayez dans 15 minutes.', status: 429 };
	}
	const supplied = await digest(`pin:${pin}`, env.SESSION_SECRET);
	const expected = await digest(`pin:${env.ADMIN_PIN}`, env.SESSION_SECRET);
	let difference = 0;
	for (let i = 0; i < supplied.length; i++) difference |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
	if (difference !== 0) return { error: 'PIN incorrect.', status: 401 };
	const token = `s1_${crypto.randomUUID()}_${crypto.randomUUID()}`;
	await db.batch([
		db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
		db.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(now),
		db.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)')
			.bind(await digest(token, env.SESSION_SECRET), now + SESSION_SECONDS * 1000)
	]);
	return { token };
}

export async function verifyAdminToken(
	db: D1Database, token: string | undefined, override?: RuntimeEnv, now = Date.now()
): Promise<boolean> {
	const env = configuration(override);
	if (!token || !/^s1_[\da-f-]{36}_[\da-f-]{36}$/.test(token) || !env.ADMIN_PIN || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return false;
	return !!await db.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
		.bind(await digest(token, env.SESSION_SECRET), now).first();
}

export async function revokeSession(db: D1Database, token: string | undefined, override?: RuntimeEnv) {
	const secret = configuration(override).SESSION_SECRET;
	if (token && secret) await db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
		.bind(await digest(token, secret)).run();
}

export function setAdminCookie(cookies: Cookies, token: string): void {
	cookies.set(COOKIE_NAME, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: !dev, maxAge: SESSION_SECONDS });
}

export function clearAdminCookie(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
