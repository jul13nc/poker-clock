import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ensureSeason, parseJsonNumberList, updateSeason } from '#lib/server/data';
import { getDb } from '#lib/server/db';
import {
	adminToken,
	checkPin,
	clearAdminCookie,
	setAdminCookie
} from '#lib/server/auth';
import { DEFAULT_POINTS_SCALE, parsePointsScale } from '#lib/domain/points';
import { parsePayoutTable, parsePayoutTableJson } from '#lib/domain/payout';
import { DEFAULT_PAYOUT_TABLE } from '#lib/domain/defaults';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform);
	const season = await ensureSeason(db);
	return {
		season,
		scale: parseJsonNumberList(season.points_scale_json, DEFAULT_POINTS_SCALE),
		payout: parsePayoutTableJson(season.payout_json, DEFAULT_PAYOUT_TABLE)
	};
};

export const actions: Actions = {
	login: async ({ request, cookies, platform }) => {
		const form = await request.formData();
		const pin = String(form.get('pin') ?? '');

		if (!checkPin(pin, platform?.env)) {
			return fail(401, { error: 'PIN incorrect.' });
		}

		setAdminCookie(cookies, await adminToken(platform?.env));
		throw redirect(303, '/admin');
	},

	logout: async ({ cookies }) => {
		clearAdminCookie(cookies);
		throw redirect(303, '/');
	},

	save: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const form = await request.formData();

		const db = getDb(platform);
		const season = await ensureSeason(db);

		const name = String(form.get('name') ?? '').trim();
		const pointsInput = String(form.get('points') ?? '');
		const payoutInput = String(form.get('payout') ?? '');
		const buyIn = Number(form.get('buy_in'));
		const defaultStack = Number(form.get('default_stack'));
		const rebuyRule = String(form.get('rebuy_rule') ?? 'after');

		if (name.length < 3 || name.length > 60) {
			return fail(400, { error: 'Le nom de la saison doit faire entre 3 et 60 caractères.' });
		}

		const points = parsePointsScale(pointsInput);
		if (!points) {
			return fail(400, { error: 'Barème de points invalide. Exemple : 10, 7, 5, 3, 2, 1' });
		}

		const payout = parsePayoutTable(payoutInput);
		if (!payout) {
			return fail(400, {
				error:
					'Table des gains invalide. Exemple : {"50":{"1":30,"2":20},"60":{"1":40,"2":20}}'
			});
		}

		if (!Number.isFinite(buyIn) || buyIn < 0) {
			return fail(400, { error: 'Buy-in invalide.' });
		}

		if (!Number.isFinite(defaultStack) || defaultStack <= 0) {
			return fail(400, { error: 'Tapis de départ invalide.' });
		}

		if (rebuyRule !== 'after' && rebuyRule !== 'normal') {
			return fail(400, { error: 'Règle de recave invalide.' });
		}

		await updateSeason(db, season.id, {
			name,
			points_scale_json: JSON.stringify(points),
			payout_json: JSON.stringify(payout),
			default_buyin: buyIn,
			default_stack: Math.round(defaultStack),
			rebuy_rule: rebuyRule
		});

		return { success: 'Réglages de la saison enregistrés.' };
	}
};
