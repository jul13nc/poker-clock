import { describe, expect, it } from 'vitest';
import { generateBlinds, planTournamentBlinds, validateBlindLevels, parseBlindText } from './blinds';

describe('édition texte des blindes', () => {
	it('déduit moitié de BB et applique durée commune en ignorant lignes vides', () => {
		const levels = parseBlindText(' 50\r\n100\r\n\r\n 200 \n', 15);
		expect(levels).toEqual([
			{ sb: 25, bb: 50, ante: 0, duration: 15 },
			{ sb: 50, bb: 100, ante: 0, duration: 15 },
			{ sb: 100, bb: 200, ante: 0, duration: 15 }
		]);
		expect(levels.reduce((sum, level) => sum + level.duration, 0)).toBe(45);
	});
	it('refuse texte vide, nombres invalides, SB fractionnaire et ordre incorrect', () => {
		for (const text of ['', '\n ', 'abc', '50\n75', '50\n50', '100\n50', '2.5', '1e3', '-50', '1000000002']) expect(() => parseBlindText(text, 20)).toThrow();
		expect(() => parseBlindText('50\n\nabc', 20)).toThrow('Ligne 3');
		for (const duration of [0, 181, 1.5, NaN]) expect(() => parseBlindText('50', duration)).toThrow('Durée');
	});
});

describe('planification selon joueurs et durée', () => {
	const plan = { playerCount: 10, totalMinutes: 240, startingStack: 10000, chipUnit: 25 };
	it('calcule niveaux et progression sans paramètres techniques', () => {
		const levels = planTournamentBlinds(plan);
		expect(levels).toHaveLength(12);
		expect(levels[0].bb).toBe(50);
		expect(levels.at(-1)!.bb).toBe(5000);
		expect(levels.reduce((sum, l) => sum + l.duration, 0)).toBe(240);
		expect(validateBlindLevels(levels)).toEqual(levels);
	});
	it('adapte fin au nombre de joueurs et au tapis', () => {
		const last = (overrides = {}) => planTournamentBlinds({ ...plan, ...overrides }).at(-1)!.bb;
		expect(last({ playerCount: 20 })).toBe(2 * last());
		expect(last({ startingStack: 20000 })).toBe(2 * last());
	});
	it('respecte durée exacte et niveaux valides sur différentes durées et jetons', () => {
		for (const totalMinutes of [20, 61, 125, 241, 1440]) {
			for (const playerCount of [2, 10, 1000]) {
				const levels = planTournamentBlinds({ ...plan, totalMinutes, playerCount });
				expect(levels.reduce((sum, l) => sum + l.duration, 0)).toBe(totalMinutes);
				expect(validateBlindLevels(levels)).toEqual(levels);
				expect(levels.every((l) => l.sb % 25 === 0)).toBe(true);
			}
		}
	});
	it('refuse joueurs, durée, tapis et jetons invalides', () => {
		for (const override of [{ playerCount: 1 }, { totalMinutes: 19 }, { totalMinutes: NaN }, { startingStack: 100 }, { chipUnit: 0 }]) expect(() => planTournamentBlinds({ ...plan, ...override })).toThrow();
	});
});

const options = { firstBigBlind: 50, growthPercent: 50, levelCount: 18, duration: 20, chipUnit: 25 };
describe('génération des blindes', () => {
	it('génère niveaux croissants, arrondis aux jetons, sans ante ni pause', () => {
		const levels = generateBlinds(options);
		expect(levels).toHaveLength(18);
		expect(levels[0]).toEqual({ sb: 25, bb: 50, ante: 0, duration: 20 });
		levels.forEach((level, index) => {
			expect(level.bb).toBe(level.sb * 2);
			expect(level.sb % options.chipUnit).toBe(0);
			expect(level.bb).toBeGreaterThan(levels[index - 1]?.bb ?? 0);
			expect(level.break).toBeUndefined();
		});
		expect(validateBlindLevels(levels)).toEqual(levels);
	});
	it('évite les doublons quand progression est inférieure à arrondi', () => {
		expect(generateBlinds({ ...options, growthPercent: 1, levelCount: 3 }).map((l) => l.bb)).toEqual([50, 100, 150]);
	});
	it('rejette paramètres invalides et débordements', () => {
		for (const override of [{ chipUnit: 0 }, { duration: 0 }, { levelCount: 101 }, { growthPercent: NaN }, { firstBigBlind: 25 }, { growthPercent: 100, levelCount: 100 }]) {
			expect(() => generateBlinds({ ...options, ...override })).toThrow();
		}
	});
});
describe('validation des structures', () => {
	it('rejette pauses, antes, durées invalides et blindes non croissantes', () => {
		const level = { sb: 25, bb: 50, ante: 0, duration: 20 };
		for (const value of [null, [], [{ ...level, break: true }], [{ ...level, ante: 5 }], [{ ...level, duration: 0 }], [{ ...level, sb: 0 }], [level, level], [{ ...level, bb: 25 }]]) expect(validateBlindLevels(value)).toBeNull();
	});
});
