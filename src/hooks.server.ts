import type { Handle } from '@sveltejs/kit/hooks';
import { verifyAdminToken } from '#lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.isAdmin = await verifyAdminToken(
		event.cookies.get('pc_admin'),
		event.platform?.env
	);
	return resolve(event);
};
