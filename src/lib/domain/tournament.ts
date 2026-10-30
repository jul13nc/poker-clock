import type { PlayerState } from './types';

/**
 * Jetons en circulation : tapis de départ × nombre d'entrées (recaves incluses).
 */
export function totalChips(startingStack: number, entries: number): number {
	return Math.max(0, Math.round(startingStack)) * Math.max(0, Math.round(entries));
}

/**
 * Stack moyen des joueurs encore en jeu. 0 si plus personne.
 */
export function averageStack(totalChips: number, remaining: number): number {
	if (remaining <= 0) return 0;
	return Math.floor(totalChips / remaining);
}

export function remainingPlayers(players: PlayerState[]): number {
	return players.filter((player) => player.finishRank === null).length;
}

/**
 * Place attribuée à un joueur qui vient d'être éliminé : il prend la dernière
 * place encore libre, c'est-à-dire le nombre de joueurs encore en jeu avant
 * son élimination.
 */
export function eliminationPlace(remainingBefore: number): number {
	return Math.max(1, Math.round(remainingBefore));
}

export type LiveRankingRow = {
	place: number;
	/** Joueur sorti à cette place, ou dernier survivant en 1re place. */
	player: PlayerState | null;
	prize: number;
};

/**
 * Classement affiché en direct : les places déjà attribuées portent le nom du
 * joueur sorti, les autres restent vides. Quand il ne reste qu'un joueur, il
 * apparaît en 1re place comme vainqueur probable avant la clôture.
 */
export function buildLiveRanking(
	players: PlayerState[],
	payouts: { place: number; amount: number }[]
): LiveRankingRow[] {
	const prizeByPlace = new Map(payouts.map((line) => [line.place, line.amount]));
	const eliminatedByPlace = new Map(
		players
			.filter((player) => player.finishRank !== null)
			.map((player) => [player.finishRank as number, player])
	);
	const remaining = players.filter((player) => player.finishRank === null).length;
	const lastSurvivor =
		remaining === 1 ? (players.find((player) => player.finishRank === null) ?? null) : null;

	return Array.from({ length: players.length }, (_, index) => {
		const place = index + 1;
		return {
			place,
			player: eliminatedByPlace.get(place) ?? (place === 1 ? lastSurvivor : null),
			prize: prizeByPlace.get(place) ?? 0
		};
	});
}
