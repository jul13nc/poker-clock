import { expect, it } from 'vitest';
import { rankStandings } from './standings';

it('inclut le leader absent et attribue même rang aux mêmes points', () => {
	const ranked = rankStandings([
		{ id: 'present', name: 'Paul', points: 10, wins: 1 },
		{ id: 'absent', name: 'Alice', points: 20, wins: 0 },
		{ id: 'tie', name: 'Bob', points: 10, wins: 0 },
		{ id: 'last', name: 'Zoé', points: 5, wins: 0 }
	]);
	expect(ranked.map((p) => [p.id, p.rank])).toEqual([['absent', 1], ['present', 2], ['tie', 2], ['last', 4]]);
});
