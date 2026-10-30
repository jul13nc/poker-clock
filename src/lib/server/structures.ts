import type { D1Database } from '@cloudflare/workers-types';
import { validateBlindLevels } from '#lib/domain/blinds';

export async function saveStructure(db: D1Database, input: { id?: string; name: string; levels: unknown; isDefault: boolean }) {
	const name = input.name.trim();
	const levels = validateBlindLevels(input.levels);
	if (name.length < 2 || name.length > 80) throw new Error('Nom requis : 2 à 80 caractères.');
	if (!levels) throw new Error('Structure invalide : 1 à 100 niveaux croissants, blindes entières positives, durée de 1 à 180 minutes, sans ante ni pause.');
	if (input.id && !await db.prepare('SELECT id FROM blind_structures WHERE id = ?').bind(input.id).first()) throw new Error('Structure introuvable.');
	const id = input.id || crypto.randomUUID();
	await db.batch([
		db.prepare(`INSERT INTO blind_structures(id, name, levels_json, is_default) VALUES (?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET name=excluded.name, levels_json=excluded.levels_json,
			is_default=CASE WHEN excluded.is_default=1 THEN 1 ELSE blind_structures.is_default END`)
			.bind(id, name, JSON.stringify(levels), input.isDefault ? 1 : 0),
		db.prepare(`UPDATE blind_structures SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE ? = 1`).bind(id, input.isDefault ? 1 : 0),
		db.prepare(`UPDATE blind_structures SET is_default=1 WHERE id=(SELECT id FROM blind_structures ORDER BY name,id LIMIT 1)
			AND NOT EXISTS(SELECT 1 FROM blind_structures WHERE is_default=1)`)
	]);
	return id;
}

export async function deleteStructure(db: D1Database, id: string) {
	const results = await db.batch([
		db.prepare('DELETE FROM blind_structures WHERE id = ? AND (SELECT COUNT(*) FROM blind_structures) > 1').bind(id),
		db.prepare(`UPDATE blind_structures SET is_default=1 WHERE id=(SELECT id FROM blind_structures ORDER BY name,id LIMIT 1)
			AND NOT EXISTS(SELECT 1 FROM blind_structures WHERE is_default=1)`)
	]);
	if (!results[0].meta.changes) throw new Error('Impossible de supprimer la dernière structure, ou structure introuvable.');
}
