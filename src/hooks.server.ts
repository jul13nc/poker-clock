import type { Handle } from '@sveltejs/kit/hooks';
import { verifyAdminToken } from '#lib/server/auth';
import { getDb } from '#lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get('pc_admin');
	event.locals.isAdmin = token ? await verifyAdminToken(getDb(event.platform), token, event.platform?.env) : false;
	return resolve(event);
};
