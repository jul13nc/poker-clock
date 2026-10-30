import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listStructures } from '#lib/server/data';
import { parseBlindText } from '#lib/domain/blinds';
import { getDb } from '#lib/server/db';
import { saveStructure, deleteStructure } from '#lib/server/structures';

export const load: PageServerLoad = async ({ platform, locals }) => {
	if (!locals.isAdmin) throw redirect(303, '/admin');
	const db = getDb(platform);
	return { structures: await listStructures(db) };
};

export const actions: Actions = {
	save: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const form = await request.formData();
		try {
			const levels = parseBlindText(String(form.get('big_blinds') ?? ''), Number(form.get('duration')));
			const savedId = await saveStructure(getDb(platform), {
				id: String(form.get('id') ?? '') || undefined, name: String(form.get('name') ?? ''),
				levels, isDefault: form.get('is_default') === 'on'
			});
			return { success: 'Configuration enregistrée.', savedId };
		} catch (error) {
			return fail(400, { error: error instanceof Error ? error.message : 'Enregistrement impossible.' });
		}
	},
	delete: async ({ request, platform, locals }) => {
		if (!locals.isAdmin) return fail(403, { error: 'Réservé à l’organisateur.' });
		const form = await request.formData();
		try { await deleteStructure(getDb(platform), String(form.get('id') ?? '')); }
		catch (error) { return fail(400, { error: error instanceof Error ? error.message : 'Suppression impossible.' }); }
		return { success: 'Configuration supprimée.', deletedId: String(form.get('id')) };
	}
};
