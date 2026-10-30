import { describe, expect, it } from 'vitest';
import { assignPoints, parsePointsScale, pointsOrder } from './points';

const entries = [
	{ playerId: 'alice', entries: 2, finishRank: 1 },
	{ playerId: 'bob', entries: 1, finishRank: 2 },
	{ playerId: 'chloe', entries: 1, finishRank: 3 },
	{ playerId: 'david', entries: 1, finishRank: 4 }
];

describe('pointsOrder', () => {
	it('place les recaveurs après les non-recavés', () => {
		expect(pointsOrder(entries, 'after').map((entry) => entry.playerId)).toEqual([
			'bob',
			'chloe',
			'david',
			'alice'
		]);
	});

	it('conserve le classement réel en mode normal', () => {
		expect(pointsOrder(entries, 'normal').map((entry) => entry.playerId)).toEqual([
			'alice',
			'bob',
			'chloe',
			'david'
		]);
	});
});

describe('assignPoints', () => {
	it('applique le barème après réordonnancement', () => {
		const result = assignPoints(entries, [10, 7, 5, 3, 2, 1], 1, 'after');
		expect(result.map((entry) => entry.points)).toEqual([10, 7, 5, 3]);
		expect(result.map((entry) => entry.pointsRank)).toEqual([1, 2, 3, 4]);
	});

	it('applique le multiplicateur de journée double', () => {
		const result = assignPoints(entries, [10, 7, 5, 3, 2, 1], 2, 'after');
		expect(result.map((entry) => entry.points)).toEqual([20, 14, 10, 6]);
	});

	it('donne zéro au-delà du barème', () => {
		const many = Array.from({ length: 8 }, (_, index) => ({
			playerId: `p${index}`,
			entries: 1,
			finishRank: index + 1
		}));
		const result = assignPoints(many, [10, 7, 5, 3, 2, 1], 1, 'after');
		expect(result.map((entry) => entry.points)).toEqual([10, 7, 5, 3, 2, 1, 0, 0]);
	});
});

describe('parsePointsScale', () => {
	it('accepte virgules, espaces et points-virgules', () => {
		expect(parsePointsScale('10, 7; 5 3')).toEqual([10, 7, 5, 3]);
	});

	it('refuse une valeur invalide', () => {
		expect(parsePointsScale('10, abc')).toBeNull();
	});
});
