export type PointsRule = 'after' | 'normal';

export type RankedEntry = {
	playerId: string;
	entries: number;
	finishRank: number;
};

export type PointsAssignment = {
	playerId: string;
	pointsRank: number;
	points: number;
};

export const DEFAULT_POINTS_SCALE = [10, 7, 5, 3, 2, 1];

/**
 * Ordre utilisé pour attribuer les points du championnat.
 *
 * Règle "after" (par défaut) : les joueurs n'ayant pas recavé sont classés
 * avant ceux ayant recavé, quel que soit leur classement réel dans le tournoi.
 * À l'intérieur de chaque groupe, l'ordre d'arrivée est conservé.
 */
export function pointsOrder<T extends RankedEntry>(entries: T[], rule: PointsRule): T[] {
	const byFinish = [...entries].sort((a, b) => a.finishRank - b.finishRank);
	if (rule === 'normal') return byFinish;
	return [
		...byFinish.filter((entry) => entry.entries <= 1),
		...byFinish.filter((entry) => entry.entries > 1)
	];
}

export function assignPoints(
	entries: RankedEntry[],
	scale: number[],
	multiplier: number,
	rule: PointsRule
): PointsAssignment[] {
	return pointsOrder(entries, rule).map((entry, index) => ({
		playerId: entry.playerId,
		pointsRank: index + 1,
		points: (scale[index] ?? 0) * multiplier
	}));
}

export function parsePointsScale(input: string): number[] | null {
	const values = input
		.split(/[,\s;]+/)
		.map((value) => value.trim())
		.filter(Boolean)
		.map(Number);

	if (values.length === 0) return null;
	if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
	return values;
}
