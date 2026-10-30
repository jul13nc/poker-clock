export type PayoutLine = {
	place: number;
	amount: number;
};

/**
 * Table des gains indexée par le montant total misé (pool), puis par place.
 * Exemple : `{ "50": { "1": 30, "2": 20 } }`.
 */
export type PayoutTable = Record<string, Record<string, number>>;

type PayoutTier = {
	pool: number;
	/** Montants par place, index 0 = 1re place. */
	amounts: number[];
};

function normalizeTable(table: PayoutTable): PayoutTier[] {
	const tiers: PayoutTier[] = [];

	for (const [poolKey, places] of Object.entries(table)) {
		const pool = Number(poolKey);
		if (!Number.isFinite(pool) || pool <= 0) continue;
		if (!places || typeof places !== 'object' || Array.isArray(places)) continue;

		const entries = Object.entries(places)
			.map(([placeKey, amount]) => ({ place: Number(placeKey), amount: Number(amount) }))
			.filter(
				(entry) =>
					Number.isInteger(entry.place) &&
					entry.place >= 1 &&
					Number.isFinite(entry.amount) &&
					entry.amount >= 0
			)
			.sort((a, b) => a.place - b.place);

		if (entries.length === 0) continue;

		const maxPlace = entries[entries.length - 1].place;
		const amounts = Array.from({ length: maxPlace }, () => 0);
		for (const entry of entries) amounts[entry.place - 1] = entry.amount;

		tiers.push({ pool, amounts });
	}

	return tiers.sort((a, b) => a.pool - b.pool);
}

/**
 * Calcule la répartition du prize pool à partir de la table des gains.
 *
 * Le pool est la somme réellement investie : buy-in × nombre total d'entrées
 * (recaves incluses). La table donne des montants fixes pour un pool donné.
 * Si le pool n'est pas dans la table, le palier le plus proche est mis à
 * l'échelle, arrondi à l'euro, et le reliquat va à la 1re place.
 */
export function computePayouts(
	playerCount: number,
	totalEntries: number,
	buyIn: number,
	table: PayoutTable
): PayoutLine[] {
	if (!Number.isSafeInteger(playerCount) || playerCount <= 0 || !Number.isSafeInteger(totalEntries) || totalEntries < 0 || !Number.isFinite(buyIn) || buyIn < 0) return [];

	const poolCents = Math.round(Math.max(0, buyIn) * Math.max(0, totalEntries) * 100);
	if (!Number.isSafeInteger(poolCents) || poolCents <= 0) return [];

	const validated = parsePayoutTable(JSON.stringify(table));
	if (!validated) throw new Error('Table des gains incohérente.');
	const tiers = normalizeTable(validated);
	if (tiers.length === 0) return [];

	const pool = poolCents / 100;
	const exact = tiers.find((tier) => Math.abs(tier.pool - pool) < 0.005);
	const reference =
		exact ??
		[...tiers].reverse().find((tier) => tier.pool <= pool) ??
		tiers[0];

	const scale = pool / reference.pool;
	const paidPlaces = Math.min(playerCount, reference.amounts.length);
	if (paidPlaces <= 0) return [];

	// Table exacte : montants tels quels. Hors table : mise à l'échelle arrondie
	// à l'euro, pour rester lisible sur une soirée entre amis.
	const amountsCents = reference.amounts
		.slice(0, paidPlaces)
		.map((amount) => (exact ? Math.round(amount * 100) : Math.round(amount * scale) * 100));

	let remainder = poolCents - amountsCents.reduce((sum, amount) => sum + amount, 0);
	// Si les arrondis dépassent le pool et épuiseraient le premier gain,
	// réduire les dernières places avant d'affecter le reliquat au vainqueur.
	if (amountsCents[0] + remainder < 0) {
		let deficit = -(amountsCents[0] + remainder);
		for (let i = amountsCents.length - 1; i > 0 && deficit > 0; i--) {
			const reduction = Math.min(amountsCents[i], deficit);
			amountsCents[i] -= reduction;
			deficit -= reduction;
		}
		remainder = poolCents - amountsCents.reduce((sum, amount) => sum + amount, 0);
	}
	amountsCents[0] += remainder;

	return amountsCents.map((cents, index) => ({
		place: index + 1,
		amount: cents / 100
	}));
}

/** Valide et normalise une table de gains saisie en JSON. */
export function parsePayoutTable(input: string): PayoutTable | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

	const table: PayoutTable = {};
	for (const [poolKey, places] of Object.entries(parsed as Record<string, unknown>)) {
		const pool = Number(poolKey);
		if (!Number.isFinite(pool) || pool <= 0 || !Number.isSafeInteger(Math.round(pool * 100)) || Math.abs(pool * 100 - Math.round(pool * 100)) > 1e-6 || String(pool) !== poolKey) return null;
		if (!places || typeof places !== 'object' || Array.isArray(places)) return null;

		const normalized: Record<string, number> = {};
		for (const [placeKey, amount] of Object.entries(places as Record<string, unknown>)) {
			const place = Number(placeKey);
			if (!Number.isInteger(place) || place < 1 || place > 1000 || String(place) !== placeKey) return null;
			if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return null;
			normalized[String(place)] = amount;
		}

		if (Object.keys(normalized).length === 0) return null;
		if (Object.values(normalized).reduce((sum, amount) => sum + Math.round(amount * 100), 0) !== Math.round(pool * 100)) return null;
		table[String(pool)] = normalized;
	}

	return Object.keys(table).length > 0 ? table : null;
}

export function parsePayoutTableJson(json: string, fallback: PayoutTable): PayoutTable {
	return parsePayoutTable(json) ?? fallback;
}
