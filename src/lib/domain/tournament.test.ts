import { describe, expect, it } from 'vitest';
import {
	averageStack,
	buildLiveRanking,
	eliminationPlace,
	remainingPlayers,
	totalChips
} from './tournament';
import type { PlayerState } from './types';

const player = (id: string, finishRank: number | null): PlayerState => ({
	id,
	name: id,
	entries: 1,
	rebuyOrder: null,
	hands72: 0,
	seat: null,
	finishRank,
	eliminatedAt: finishRank === null ? null : '2026-10-29T20:00:00.000Z'
});

describe('totalChips', () => {
	it('multiplie le tapis de départ par les entrées', () => {
		expect(totalChips(5000, 4)).toBe(20_000);
	});

	it('inclut les recaves', () => {
		expect(totalChips(5000, 5)).toBe(25_000);
	});

	it('ignore les valeurs négatives', () => {
		expect(totalChips(-100, 3)).toBe(0);
	});
});

describe('averageStack', () => {
	it('divise les jetons par les joueurs restants', () => {
		expect(averageStack(20_000, 3)).toBe(6666);
	});

	it('vaut 0 quand plus personne n’est en jeu', () => {
		expect(averageStack(20_000, 0)).toBe(0);
	});
});

describe('remainingPlayers', () => {
	it('ne compte que les joueurs sans place finale', () => {
		expect(remainingPlayers([player('a', null), player('b', 3), player('c', null)])).toBe(2);
	});
});

describe('eliminationPlace', () => {
	it('attribue la dernière place libre', () => {
		expect(eliminationPlace(4)).toBe(4);
	});

	it('ne descend pas sous 1', () => {
		expect(eliminationPlace(0)).toBe(1);
	});
});

describe('buildLiveRanking', () => {
	const payouts = [
		{ place: 1, amount: 103 },
		{ place: 2, amount: 46 },
		{ place: 3, amount: 11 }
	];

	it('laisse vides les places encore en jeu et nomme les sortis', () => {
		const rows = buildLiveRanking(
			[
				player('a', null),
				player('b', null),
				player('c', null),
				player('d', null),
				player('e', 5),
				player('f', 6)
			],
			payouts
		);

		expect(rows.map((row) => row.player?.id ?? null)).toEqual([null, null, null, null, 'e', 'f']);
		expect(rows.map((row) => row.prize)).toEqual([103, 46, 11, 0, 0, 0]);
	});

	it('affiche le dernier joueur en lice en 1re place', () => {
		const rows = buildLiveRanking(
			[player('a', null), player('b', 2), player('c', 3)],
			payouts
		);

		expect(rows.map((row) => row.player?.id ?? null)).toEqual(['a', 'b', 'c']);
		expect(rows.map((row) => row.prize)).toEqual([103, 46, 11]);
	});

	it('affiche tout le classement une fois le tournoi terminé', () => {
		const rows = buildLiveRanking([player('a', 1), player('b', 2)], payouts);

		expect(rows.map((row) => row.player?.id)).toEqual(['a', 'b']);
	});

	it('retourne une liste vide sans joueur', () => {
		expect(buildLiveRanking([], payouts)).toEqual([]);
	});
});
