import { describe, expect, it } from 'vitest';
import {
	addTime,
	computeClock,
	nextLevel,
	pauseClock,
	previousLevel,
	rebuyRemainingMs,
	resumeClock,
	startClock
} from './clock';
import type { Level } from './types';

const MIN = 60_000;
const T0 = 1_000_000;
const levels: Level[] = [
	{ sb: 25, bb: 50, ante: 0, duration: 20 },
	{ sb: 50, bb: 100, ante: 0, duration: 20 },
	{ sb: 75, bb: 150, ante: 0, duration: 20 }
];

describe('computeClock', () => {
	it('reste en attente sans horloge', () => {
		const view = computeClock(levels, null, T0);
		expect(view.status).toBe('idle');
		expect(view.index).toBe(-1);
	});

	it('démarre au premier niveau', () => {
		const view = computeClock(levels, startClock(T0), T0);
		expect(view.status).toBe('running');
		expect(view.index).toBe(0);
		expect(view.remainingMs).toBe(20 * MIN);
	});

	it('passe au niveau suivant à la fin du temps', () => {
		const view = computeClock(levels, startClock(T0), T0 + 20 * MIN + 1);
		expect(view.index).toBe(1);
		expect(view.remainingMs).toBe(20 * MIN - 1);
	});

	it('gèle le temps pendant une pause', () => {
		const paused = pauseClock(startClock(T0), T0 + 5 * MIN)!;
		const view = computeClock(levels, paused, T0 + 15 * MIN);
		expect(view.status).toBe('paused');
		expect(view.remainingMs).toBe(15 * MIN);
	});

	it('déduit la pause à la reprise', () => {
		const paused = pauseClock(startClock(T0), T0 + 5 * MIN)!;
		const resumed = resumeClock(paused, T0 + 15 * MIN)!;
		const view = computeClock(levels, resumed, T0 + 17 * MIN);
		expect(view.status).toBe('running');
		expect(view.remainingMs).toBe(13 * MIN);
	});

	it('se termine à la fin de la structure', () => {
		const view = computeClock(levels, startClock(T0), T0 + 60 * MIN);
		expect(view.status).toBe('finished');
		expect(view.remainingMs).toBe(0);
	});
});

describe('commandes manuelles', () => {
	it('saute au niveau suivant', () => {
		const clock = nextLevel(levels, startClock(T0), T0 + MIN)!;
		const view = computeClock(levels, clock, T0 + MIN);
		expect(view.index).toBe(1);
		expect(view.remainingMs).toBe(20 * MIN);
	});

	it('revient au niveau précédent', () => {
		const clock = previousLevel(levels, startClock(T0), T0 + 21 * MIN)!;
		const view = computeClock(levels, clock, T0 + 21 * MIN);
		expect(view.index).toBe(0);
		expect(view.remainingMs).toBe(20 * MIN);
	});

	it('ajoute du temps', () => {
		const clock = addTime(startClock(T0), 5 * MIN)!;
		const view = computeClock(levels, clock, T0 + 10 * MIN);
		expect(view.remainingMs).toBe(15 * MIN);
	});
});

describe('compte à rebours des recaves', () => {
	it('attend le démarrage et respecte la durée configurée', () => {
		expect(rebuyRemainingMs(90, null, T0)).toBe(90 * MIN);
		expect(rebuyRemainingMs(45, startClock(T0), T0 + 10 * MIN)).toBe(35 * MIN);
	});

	it('gèle pendant une pause et déduit sa durée à la reprise', () => {
		const paused = pauseClock(startClock(T0), T0 + 30 * MIN)!;
		expect(rebuyRemainingMs(90, paused, T0 + 50 * MIN)).toBe(60 * MIN);
		const resumed = resumeClock(paused, T0 + 50 * MIN)!;
		expect(rebuyRemainingMs(90, resumed, T0 + 55 * MIN)).toBe(55 * MIN);
	});

	it('ignore les changements de niveau et le temps ajouté aux blindes', () => {
		const next = nextLevel(levels, startClock(T0), T0 + MIN)!;
		const previous = previousLevel(levels, next, T0 + MIN)!;
		const adjusted = addTime(previous, 5 * MIN)!;
		for (const clock of [next, previous, adjusted]) {
			expect(rebuyRemainingMs(90, clock, T0 + MIN)).toBe(89 * MIN);
		}
	});

	it('reste à zéro après expiration ou si les recaves sont désactivées', () => {
		expect(rebuyRemainingMs(90, startClock(T0), T0 + 90 * MIN)).toBe(0);
		expect(rebuyRemainingMs(90, startClock(T0), T0 + 100 * MIN)).toBe(0);
		expect(rebuyRemainingMs(0, null, T0)).toBe(0);
	});
});
