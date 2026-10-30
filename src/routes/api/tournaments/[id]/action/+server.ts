import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseCommand } from '#lib/domain/commands';
import { buildTournamentState } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import { CommandError, executeCommand } from '#lib/server/commands';

export const POST: RequestHandler = async ({ params, request, platform, locals }) => {
	if (!locals.isAdmin) return json({ error: 'Action réservée à l’organisateur.' }, { status: 401 });
	let input: unknown;
	try { input = await request.json(); } catch { return json({ error: 'JSON invalide.' }, { status: 400 }); }
	const command = parseCommand(input);
	if (!command) return json({ error: 'Commande invalide.' }, { status: 400 });
	const db = getDb(platform);
	try { await executeCommand(db, params.id, command); }
	catch (error) {
		if (error instanceof CommandError) return json({ error: error.message }, { status: error.status });
		throw error;
	}
	return json({ state: await buildTournamentState(db, params.id), serverNow: Date.now() }, { headers: { 'cache-control': 'no-store' } });
};
