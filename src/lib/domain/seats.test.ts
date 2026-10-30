import { describe, expect, it } from 'vitest';
import { drawSeats } from './seats';

describe('drawSeats', () => {
	it('attribue une place unique à chaque joueur', () => {
		const result = drawSeats(['a', 'b', 'c', 'd', 'e']);
		const seats = result.map((entry) => entry.seat).sort((x, y) => x - y);
		expect(seats).toEqual([1, 2, 3, 4, 5]);
		expect(new Set(result.map((entry) => entry.playerId)).size).toBe(5);
	});

	it('est déterministe avec la même suite aléatoire', () => {
		const sequence = () => {
			const values = [0.1, 0.7, 0.3, 0.9];
			let index = 0;
			return () => values[index++ % values.length];
		};
		const first = drawSeats(['a', 'b', 'c', 'd'], sequence());
		const second = drawSeats(['a', 'b', 'c', 'd'], sequence());
		expect(first).toEqual(second);
	});

	it('accepte un seul joueur', () => {
		expect(drawSeats(['a'])).toEqual([{ playerId: 'a', seat: 1 }]);
	});

	it('gère une liste vide', () => {
		expect(drawSeats([])).toEqual([]);
	});
});
