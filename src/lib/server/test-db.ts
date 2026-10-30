import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';

/** Adaptateur SQLite réel pour vérifier SQL, contraintes et rollback des batches D1. */
export function testDb() {
	const sqlite = new DatabaseSync(':memory:');
	for (const name of readdirSync('migrations').filter((name) => name.endsWith('.sql')).sort()) {
		sqlite.exec(readFileSync(`migrations/${name}`, 'utf8'));
	}
	function prepare(sql: string) {
		let params: (string | number | null)[] = [];
		return {
			bind(...values: (string | number | null)[]) { params = values; return this; },
			async first() { return sqlite.prepare(sql).get(...params) ?? null; },
			async all() { return { results: sqlite.prepare(sql).all(...params), success: true, meta: {} }; },
			async run() { const result = sqlite.prepare(sql).run(...params); return { success: true, results: [], meta: { changes: Number(result.changes) } }; }
		};
	}
	const db = {
		prepare,
		async batch(statements: { run(): Promise<unknown> }[]) {
			sqlite.exec('BEGIN');
			try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
			catch (error) { sqlite.exec('ROLLBACK'); throw error; }
		}
	} as unknown as D1Database;
	return { db, sqlite };
}
