import type { PayoutTable } from './payout';

/** Buy-in par défaut d'une soirée. */
export const DEFAULT_BUYIN = 10;

/** Durée des recaves en minutes à partir du démarrage du tournoi. */
export const DEFAULT_REBUY_DURATION = 90;

export const DEFAULT_BIG_BLINDS = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2400, 3000, 4000];
export const DEFAULT_LEVEL_DURATION = 15;

/**
 * Table des gains par montant total misé (buy-in × entrées, recaves incluses).
 * Les clés sont des pools en euros, en multiples de 10.
 */
export const DEFAULT_PAYOUT_TABLE: PayoutTable = {
	'50': { '1': 30, '2': 20 },
	'60': { '1': 40, '2': 20 },
	'70': { '1': 40, '2': 20, '3': 10 },
	'80': { '1': 40, '2': 30, '3': 10 },
	'90': { '1': 50, '2': 30, '3': 10 },
	'100': { '1': 60, '2': 30, '3': 10 },
	'110': { '1': 70, '2': 30, '3': 10 },
	'120': { '1': 70, '2': 40, '3': 10 },
	'130': { '1': 80, '2': 40, '3': 10 },
	'140': { '1': 90, '2': 40, '3': 10 }
};
