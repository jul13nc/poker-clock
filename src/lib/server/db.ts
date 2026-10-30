import { env as workerEnv } from 'cloudflare:workers';
import type { D1Database } from '@cloudflare/workers-types';

type RuntimeEnv = {
	DB?: D1Database;
};

export function getDb(platform?: App.Platform): D1Database {
	const database = platform?.env?.DB ?? (workerEnv as unknown as RuntimeEnv).DB;
	if (!database) {
		throw new Error(
			"Binding D1 « DB » introuvable. Vérifiez wrangler.jsonc puis lancez `npm run db:migrate`."
		);
	}
	return database;
}

export async function queryAll<T>(
	database: D1Database,
	sql: string,
	...params: unknown[]
): Promise<T[]> {
	const statement = params.length ? database.prepare(sql).bind(...params) : database.prepare(sql);
	const { results } = await statement.all<T>();
	return (results ?? []) as T[];
}

export async function queryOne<T>(
	database: D1Database,
	sql: string,
	...params: unknown[]
): Promise<T | null> {
	const statement = params.length ? database.prepare(sql).bind(...params) : database.prepare(sql);
	return ((await statement.first<T>()) ?? null) as T | null;
}

export async function execute(
	database: D1Database,
	sql: string,
	...params: unknown[]
): Promise<void> {
	const statement = params.length ? database.prepare(sql).bind(...params) : database.prepare(sql);
	await statement.run();
}
