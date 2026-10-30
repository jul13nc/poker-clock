import type { Level } from './types';

export type BlindGenerator = {
	firstBigBlind: number;
	growthPercent: number;
	levelCount: number;
	duration: number;
	chipUnit: number;
};

const MAX_BLIND = 1_000_000_000;

/** Une grosse blinde entière paire par ligne ; lignes vides ignorées. */
export function parseBlindText(text: string, duration: number): Level[] {
	if (!Number.isSafeInteger(duration) || duration < 1 || duration > 180) throw new Error('Durée commune : 1 à 180 minutes entières.');
	const lines = text.split(/\r?\n/).map((value, index) => ({ value: value.trim(), line: index + 1 })).filter(({ value }) => value !== '');
	if (lines.length < 1 || lines.length > 100) throw new Error('Saisissez 1 à 100 niveaux, une grosse blinde par ligne.');
	let previous = 0;
	return lines.map(({ value, line }) => {
		const bb = Number(value);
		if (!/^\d+$/.test(value) || !Number.isSafeInteger(bb) || bb < 2 || bb > MAX_BLIND || bb % 2 !== 0) throw new Error(`Ligne ${line} : BB entière paire requise, de 2 à ${MAX_BLIND}, pour obtenir une SB entière.`);
		if (bb <= previous) throw new Error(`Ligne ${line} : la BB doit être supérieure à celle du niveau précédent.`);
		previous = bb;
		return { sb: bb / 2, bb, ante: 0, duration };
	});
}

export type TournamentBlindOptions = {
	playerCount: number;
	totalMinutes: number;
	startingStack: number;
	chipUnit: number;
};

/** Estimation sans ante : départ vers 200 BB, fin vers 20 BB en circulation. */
export function planTournamentBlinds(options: TournamentBlindOptions): Level[] {
	const { playerCount, totalMinutes, startingStack, chipUnit } = options;
	if (![playerCount, totalMinutes, startingStack, chipUnit].every(Number.isSafeInteger) ||
		playerCount < 2 || playerCount > 1000 || totalMinutes < 20 || totalMinutes > 1440 ||
		chipUnit < 1 || startingStack < chipUnit * 20 || startingStack > MAX_BLIND) {
		throw new Error('Indiquez 2 à 1 000 joueurs, 20 à 1 440 minutes et un tapis d’au moins 20 jetons de la plus petite valeur.');
	}
	const step = chipUnit * 2;
	const first = Math.max(step, Math.round(startingStack / 200 / step) * step);
	const last = Math.max(first + step, Math.round(playerCount * startingStack / 20 / step) * step);
	if (last > MAX_BLIND) throw new Error('Volume de jetons trop élevé pour générer la structure.');
	const count = Math.min(100, Math.floor(totalMinutes / 5), Math.max(2, Math.round(totalMinutes / 20)), (last - first) / step + 1);
	const baseDuration = Math.floor(totalMinutes / count);
	let previous = first - step;
	return Array.from({ length: count }, (_, index) => {
		const target = first * (last / first) ** (index / (count - 1));
		const bb = Math.min(last - (count - 1 - index) * step,
			Math.max(previous + step, Math.round(target / step) * step));
		previous = bb;
		return { sb: bb / 2, bb, ante: 0, duration: baseDuration + (index < totalMinutes % count ? 1 : 0) };
	});
}

export function generateBlinds(options: BlindGenerator): Level[] {
	const { firstBigBlind, growthPercent, levelCount, duration, chipUnit } = options;
	if (![firstBigBlind, levelCount, duration, chipUnit].every(Number.isSafeInteger) ||
		chipUnit < 1 || firstBigBlind < 2 * chipUnit || firstBigBlind > MAX_BLIND ||
		levelCount < 1 || levelCount > 100 || duration < 1 || duration > 180 ||
		!Number.isFinite(growthPercent) || growthPercent < 1 || growthPercent > 100) {
		throw new Error('Paramètres invalides : 1 à 100 niveaux, 1 à 180 min, progression de 1 à 100 %, grosse blinde ≥ 2 jetons minimum.');
	}
	let previous = 0;
	return Array.from({ length: levelCount }, (_, index) => {
		const target = firstBigBlind * (1 + growthPercent / 100) ** index;
		// Arrondir par paire de jetons permet de garder petite blinde = grosse / 2.
		const bb = Math.max(previous + 2 * chipUnit, Math.round(target / (2 * chipUnit)) * 2 * chipUnit);
		if (!Number.isSafeInteger(bb) || bb > MAX_BLIND) throw new Error('Progression trop élevée : réduisez croissance ou nombre de niveaux.');
		previous = bb;
		return { sb: bb / 2, bb, ante: 0, duration };
	});
}

/** Validation stricte des configurations réutilisables ; aucune ante ni pause. */
export function validateBlindLevels(value: unknown): Level[] | null {
	if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
	let previous = 0;
	const result: Level[] = [];
	for (const level of value) {
		if (!level || typeof level !== 'object' || level.break || (level.ante !== undefined && level.ante !== 0) ||
			!Number.isSafeInteger(level.sb) || !Number.isSafeInteger(level.bb) || !Number.isSafeInteger(level.duration) ||
			level.sb < 1 || level.bb <= level.sb || level.bb <= previous || level.bb > MAX_BLIND || level.duration < 1 || level.duration > 180) return null;
		result.push({ sb: level.sb, bb: level.bb, ante: 0, duration: level.duration });
		previous = level.bb;
	}
	return result;
}
