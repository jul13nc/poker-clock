export function seasonWindow(date = new Date()): { start: string; end: string; name: string } {
	const year = date.getFullYear();
	const month = date.getMonth() + 1;

	// Sept.–déc. : saison en cours. Janv.–juin : saison commencée l'an dernier.
	// Juil.–août : intersaison, on prépare la saison qui démarre en septembre.
	const startYear = month >= 9 ? year : month <= 6 ? year - 1 : year;

	return {
		start: `${startYear}-09-01`,
		end: `${startYear + 1}-06-30`,
		name: `Saison ${startYear}-${startYear + 1}`
	};
}

export function formatDateFr(iso: string): string {
	const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
	if (!year || !month || !day) return iso;
	return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('fr-FR', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatEuro(value: number): string {
	const rounded = Math.round(value * 100) / 100;
	return `${rounded.toFixed(2).replace(/\.00$/, '').replace('.', ',')} €`;
}

export function formatNumber(value: number): string {
	return value.toLocaleString('fr-FR');
}

/** Jetons : nombre entier, séparateur de milliers français. */
export function formatChips(value: number): string {
	return Math.round(value).toLocaleString('fr-FR');
}
