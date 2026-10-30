import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const directory = process.env.RUNNER_TEMP;
if (!directory) throw new Error('RUNNER_TEMP requis : script réservé à GitHub Actions.');
const secretsPath = join(directory, 'poker-clock-secrets.json');
if (process.argv.includes('--cleanup')) {
	rmSync(secretsPath, { force: true });
} else {
	for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_DATABASE_ID', 'ADMIN_PIN', 'SESSION_SECRET']) {
		if (!process.env[name]) throw new Error(`Configuration GitHub manquante : ${name}`);
	}
	if (process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET doit contenir au moins 32 caractères.');
	const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
	if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(databaseId) || databaseId === '00000000-0000-0000-0000-000000000000') {
		throw new Error('CLOUDFLARE_DATABASE_ID doit être un UUID D1 valide.');
	}
	const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'));
	if (parsed.error) throw new Error('wrangler.jsonc invalide.');
	const config = parsed.config;
	const database = config.d1_databases.find((entry) => entry.binding === 'DB');
	if (!database) throw new Error('Binding DB absent de wrangler.jsonc.');
	database.database_id = databaseId;
	config.account_id = process.env.CLOUDFLARE_ACCOUNT_ID;
	writeFileSync('wrangler.jsonc', `${JSON.stringify(config, null, 2)}\n`);
	writeFileSync(secretsPath, JSON.stringify({ ADMIN_PIN: process.env.ADMIN_PIN, SESSION_SECRET: process.env.SESSION_SECRET }), { mode: 0o600 });
}
