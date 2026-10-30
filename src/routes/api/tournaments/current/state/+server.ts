import type { RequestHandler } from './$types';
import { getDb } from '#lib/server/db';
import { stateResponse } from '#lib/server/state-response';
export const GET: RequestHandler = ({ platform, request }) => stateResponse(getDb(platform), request);
