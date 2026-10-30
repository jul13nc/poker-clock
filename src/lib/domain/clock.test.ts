import { describe, expect, it } from 'vitest';
import {
	addTime,
	computeClock,
	nextLevel,
	pauseClock,
	previousLevel,
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
