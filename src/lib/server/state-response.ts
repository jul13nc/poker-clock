import type { D1Database } from '@cloudflare/workers-types';
import { buildTournamentState, getCurrentTournament, getTournament } from './data';

export async function stateResponse(db: D1Database, request: Request, id?: string): Promise<Response> {
	const tournament = id ? await getTournament(db, id) : await getCurrentTournament(db);
	if (id && !tournament) return Response.json({ error: 'Tournoi introuvable.' }, { status: 404 });
	const tag = (state: { id: string; revision: number } | null) => `"${state ? `${state.id}:${state.revision}` : 'none'}"`;
	const headers = { 'cache-control': 'no-store', etag: tag(tournament), 'x-server-now': String(Date.now()) };
	if (request.headers.get('if-none-match') === headers.etag) return new Response(null, { status: 304, headers });
	const state = tournament ? await buildTournamentState(db, tournament.id, tournament) : null;
	headers.etag = tag(state);
	headers['x-server-now'] = String(Date.now());
	return Response.json({ state, serverNow: Number(headers['x-server-now']) }, { headers });
}
