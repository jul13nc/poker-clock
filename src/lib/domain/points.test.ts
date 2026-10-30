import { describe, expect, it } from 'vitest';
import { assignPoints, parsePointsScale, pointsOrder } from './points';

const entries = [
	{ playerId: 'alice', entries: 2, rebuyOrder: 1, finishRank: 1 },
	{ playerId: 'bob', entries: 1, rebuyOrder: null, finishRank: 2 },
	{ playerId: 'chloe', entries: 1, rebuyOrder: null, finishRank: 3 },
	{ playerId: 'david', entries: 1, rebuyOrder: null, finishRank: 4 }
];

describe('pointsOrder', () => {
	it('classe R1 dernier et R2 avant-dernier, indépendamment du résultat et du nombre de recaves', () => {
		const players = [
			{ playerId: 'r1', entries: 3, rebuyOrder: 1, finishRank: 1 },
			{ playerId: 'r3', entries: 2, rebuyOrder: 3, finishRank: 2 },
			{ playerId: 'r2', entries: 2, rebuyOrder: 2, finishRank: 3 },
			{ playerId: 'sans', entries: 1, rebuyOrder: null, finishRank: 4 }
		];
		expect(pointsOrder(players, 'after').map((entry) => entry.playerId)).toEqual([
			'sans', 'r3', 'r2', 'r1'
		]);
		expect(assignPoints(players, [10, 7, 5, 3], 1, 'after')).toEqual([
			{ playerId: 'sans', pointsRank: 1, points: 10 },
			{ playerId: 'r3', pointsRank: 2, points: 7 },
			{ playerId: 'r2', pointsRank: 3, points: 5 },
			{ playerId: 'r1', pointsRank: 4, points: 3 }
		]);
		expect(pointsOrder(players, 'normal').map((entry) => entry.playerId)).toEqual([
			'r1', 'r3', 'r2', 'sans'
		]);
	});

	it('conserve un ordre déterministe pour les recaves historiques inconnues', () => {
		const players = [
			{ playerId: 'r1', entries: 2, rebuyOrder: 1, finishRank: 1 },
			{ playerId: 'ancien2', entries: 2, rebuyOrder: null, finishRank: 3 },
			{ playerId: 'ancien1', entries: 2, rebuyOrder: null, finishRank: 2 }
		];
		expect(pointsOrder(players, 'after').map((entry) => entry.playerId)).toEqual([
			'ancien1', 'ancien2', 'r1'
		]);
	});

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
			rebuyOrder: null,
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
