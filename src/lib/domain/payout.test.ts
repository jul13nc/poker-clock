import { describe, expect, it } from 'vitest';
import { computePayouts, parsePayoutTable } from './payout';
import { DEFAULT_PAYOUT_TABLE } from './defaults';

describe('computePayouts', () => {
	it('garantit les invariants sur petits pools décimaux et nombreuses places', () => {
		const table = { '10': { '1': 0, '2': 5, '3': 5 } };
		for (let cents = 1; cents < 2000; cents++) {
			const payouts = computePayouts(3, 1, cents / 100, table);
			expect(payouts.every((p) => Number.isFinite(p.amount) && p.amount >= 0)).toBe(true);
			expect(payouts.reduce((sum, p) => sum + Math.round(p.amount * 100), 0)).toBe(cents);
		}
	});
	it('refuse la table qui produisait un gain négatif', () => {
		expect(() => computePayouts(2, 5, 10, { '50': { '1': 30, '2': 100 } })).toThrow();
	});
	it('utilise la ligne exacte de la table', () => {
		const payouts = computePayouts(5, 5, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.map((line) => line.amount)).toEqual([30, 20]);
		expect(payouts.reduce((sum, line) => sum + line.amount, 0)).toBe(50);
	});

	it('paie trois places à partir d’un pool de 70 €', () => {
		const payouts = computePayouts(7, 7, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.map((line) => line.amount)).toEqual([40, 20, 10]);
	});

	it('inclut les recaves dans le pool', () => {
		const payouts = computePayouts(6, 9, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.map((line) => line.amount)).toEqual([50, 30, 10]);
	});

	it('reverse le reliquat à la 1re place quand il y a moins de joueurs que de places', () => {
		const payouts = computePayouts(2, 10, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.map((line) => line.amount)).toEqual([70, 30]);
	});

	it('met le palier à l’échelle au-delà de la table', () => {
		const payouts = computePayouts(15, 15, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.reduce((sum, line) => sum + line.amount, 0)).toBe(150);
		expect(payouts.map((line) => line.amount)).toEqual([96, 43, 11]);
	});

	it('met le palier à l’échelle en dessous de la table', () => {
		const payouts = computePayouts(4, 4, 10, DEFAULT_PAYOUT_TABLE);
		expect(payouts.reduce((sum, line) => sum + line.amount, 0)).toBe(40);
		expect(payouts.map((line) => line.amount)).toEqual([24, 16]);
	});

	it('retourne une liste vide sans mise', () => {
		expect(computePayouts(3, 3, 0, DEFAULT_PAYOUT_TABLE)).toEqual([]);
	});
});

describe('parsePayoutTable', () => {
	it('refuse dépassement du pool, places extrêmes et clés ambiguës', () => {
		for (const value of ['{"50":{"1":30,"2":100}}', '{"50":{"1000000000":50}}', '{"50":{"01":50}}', '{"050":{"1":50}}', '{"50":{"1":49}}']) expect(parsePayoutTable(value)).toBeNull();
	});
	it('accepte la table JSON fournie', () => {
		const table = parsePayoutTable(
			'{"50":{"1":30,"2":20},"70":{"1":40,"2":20,"3":10}}'
		);
		expect(table).toEqual({
			'50': { '1': 30, '2': 20 },
			'70': { '1': 40, '2': 20, '3': 10 }
		});
	});

	it('refuse un tableau de pourcentages', () => {
		expect(parsePayoutTable('[50, 30, 20]')).toBeNull();
	});

	it('refuse un montant négatif', () => {
		expect(parsePayoutTable('{"50":{"1":-10}}')).toBeNull();
	});

	it('refuse un JSON invalide', () => {
		expect(parsePayoutTable('{oops')).toBeNull();
	});
});
