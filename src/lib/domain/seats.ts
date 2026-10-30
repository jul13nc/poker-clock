export type SeatAssignment = {
	playerId: string;
	seat: number;
};

/**
 * Tire les places au sort (mélange de Fisher-Yates).
 *
 * `random` doit renvoyer un nombre dans [0, 1). Il est injectable pour les tests.
 */
export function drawSeats(
	playerIds: string[],
	random: () => number = Math.random
): SeatAssignment[] {
	const shuffled = [...playerIds];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled.map((playerId, index) => ({ playerId, seat: index + 1 }));
}

/** Générateur cryptographique, pour un tirage non prédictible. */
export function secureRandom(): number {
	const buffer = new Uint32Array(1);
	crypto.getRandomValues(buffer);
	return buffer[0] / 0x1_0000_0000;
}
