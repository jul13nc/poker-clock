import { describe, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { testDb } from './test-db';
import { saveStructure, deleteStructure } from './structures';
import { generateBlinds } from '#lib/domain/blinds';
import { DEFAULT_BIG_BLINDS, DEFAULT_LEVEL_DURATION } from '#lib/domain/defaults';

const levels = generateBlinds({ firstBigBlind: 50, growthPercent: 50, duration: 20, chipUnit: 25, levelCount: 12 });
describe('configurations de blindes', () => {
	it('crée plusieurs modèles, modifie et remplace configuration par défaut', async () => {
		const { db, sqlite } = testDb();
		const id = await saveStructure(db, { name: 'Rapide', levels, isDefault: true });
		await saveStructure(db, { name: 'Lente', levels, isDefault: false });
		await saveStructure(db, { id, name: 'Rapide modifiée', levels: levels.slice(0, 5), isDefault: false });
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM blind_structures').get()!.n).toBe(3);
		expect(sqlite.prepare('SELECT id FROM blind_structures WHERE is_default=1').all()).toEqual([{ id }]);
		expect(JSON.parse(String(sqlite.prepare('SELECT levels_json FROM blind_structures WHERE id=?').get(id)!.levels_json))).toHaveLength(5);
	});
	it('suppression remplace défaut, conserve au moins un modèle et copie tournoi', async () => {
		const { db, sqlite } = testDb();
		sqlite.exec("INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','S','2026-09-01','2027-06-30'); INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 't','s','T','2026-10-30',levels_json FROM blind_structures WHERE id='default'");
		const original = sqlite.prepare('SELECT structure_json FROM tournaments').get()!.structure_json;
		await saveStructure(db, { name: 'Autre', levels, isDefault: false });
		await deleteStructure(db, 'default');
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM blind_structures WHERE is_default=1').get()!.n).toBe(1);
		expect(sqlite.prepare('SELECT structure_json FROM tournaments').get()!.structure_json).toBe(original);
		const last = String(sqlite.prepare('SELECT id FROM blind_structures').get()!.id);
		await expect(deleteStructure(db, last)).rejects.toThrow('dernière');
	});
	it('migration retire pause du modèle standard sans ante', () => {
		const { sqlite } = testDb();
		const standard = JSON.parse(String(sqlite.prepare("SELECT levels_json FROM blind_structures WHERE id='default'").get()!.levels_json));
		expect(standard.map((l: { bb: number }) => l.bb)).toEqual(DEFAULT_BIG_BLINDS);
		expect(standard.every((l: { bb: number; sb: number; duration: number }) => l.sb === l.bb / 2 && l.duration === DEFAULT_LEVEL_DURATION)).toBe(true);
		expect(standard.reduce((sum: number, l: { duration: number }) => sum + l.duration, 0)).toBe(225);
		expect(standard.every((l: { ante: number; break?: boolean }) => l.ante === 0 && !l.break)).toBe(true);
	});
	it('refuse structure invalide ou ID absent', async () => {
		const { db } = testDb();
		await expect(saveStructure(db, { name: 'Test', levels: [{ ...levels[0], ante: 1 }], isDefault: false })).rejects.toThrow('invalide');
		await expect(saveStructure(db, { id: 'missing', name: 'Test', levels, isDefault: false })).rejects.toThrow('introuvable');
	});
});
