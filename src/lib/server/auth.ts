import { env as workerEnv } from 'cloudflare:workers';
import { dev } from '$app/env';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_NAME = 'pc_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

type RuntimeEnv = {
	ADMIN_PIN?: string;
	SESSION_SECRET?: string;
};

function runtime(envOverride?: App.Platform['env']): RuntimeEnv {
	return (envOverride as RuntimeEnv | undefined) ?? (workerEnv as unknown as RuntimeEnv);
}

function getSecret(envOverride?: App.Platform['env']): string {
	return runtime(envOverride).SESSION_SECRET || 'dev-secret-a-changer';
}

async function sign(value: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
	return Array.from(new Uint8Array(signature))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

export async function adminToken(envOverride?: App.Platform['env']): Promise<string> {
	return sign('admin:v1', getSecret(envOverride));
}

export async function verifyAdminToken(
	token: string | undefined,
	envOverride?: App.Platform['env']
): Promise<boolean> {
	if (!token) return false;
	return safeEqual(token, await adminToken(envOverride));
}

export function checkPin(pin: string, envOverride?: App.Platform['env']): boolean {
	const expected = runtime(envOverride).ADMIN_PIN || '1234';
	return safeEqual(pin, expected);
}

export function setAdminCookie(cookies: Cookies, token: string): void {
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: COOKIE_MAX_AGE
	});
}

export function clearAdminCookie(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
