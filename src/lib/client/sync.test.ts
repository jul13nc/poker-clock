import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerClock, TournamentSync } from './sync';
import type { TournamentState } from '#lib/domain/types';

const state = (revision: number, id = 'a') => ({ id, revision }) as TournamentState;
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('temps serveur', () => {
	it('ignore heure système locale et progresse avec horloge monotone', () => {
		const now = vi.spyOn(performance, 'now').mockReturnValue(100);
		const clock = new ServerClock();
		clock.calibrate(1_000_000, 0, 100);
		expect(clock.now()).toBe(1_000_050);
		vi.spyOn(Date, 'now').mockReturnValue(-999_999);
		now.mockReturnValue(1100);
		expect(clock.now()).toBe(1_001_050);
		vi.restoreAllMocks();
	});
});

describe('synchronisation', () => {
	it('refuse état plus ancien après réponse de commande et ancien tournoi retardé', () => {
		const changed = vi.fn();
		const sync = new TournamentSync('/state', state(1), changed);
		expect(sync.accept({ state: state(3), serverNow: 300 }, 0)).toBe(true);
		expect(sync.accept({ state: state(2), serverNow: 400 }, 0)).toBe(false);
		expect(sync.accept({ state: state(4), serverNow: 200 }, 0)).toBe(false);
		expect(sync.accept({ state: state(0, 'b'), serverNow: 500 }, 0)).toBe(true);
		expect(sync.accept({ state: state(5), serverNow: 450 }, 0)).toBe(false);
		expect(changed).toHaveBeenCalledTimes(2);
	});
	it('un seul GET, timeout, reprise progressive et annulation au démontage', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		const fetcher = vi.fn((_url, init) => new Promise((_resolve, reject) => {
			init.signal.addEventListener('abort', () => reject(new Error('aborted')));
		}));
		vi.stubGlobal('fetch', fetcher);
		const status = vi.fn();
		const sync = new TournamentSync('/state', state(0), vi.fn(), status, 1000);
		const stop = sync.start();
		await sync.refresh();
		expect(fetcher).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(8000);
		expect(status).toHaveBeenCalledWith({ connected: false, lastSync: null });
		await vi.advanceTimersByTimeAsync(2000);
		expect(fetcher).toHaveBeenCalledTimes(2);
		stop();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
	it('une réponse HTTP en erreur signale hors ligne, puis reconnexion accepte nouvel état', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(Response.json({ state: state(1), serverNow: 1000 }));
		vi.stubGlobal('fetch', fetcher);
		const changed = vi.fn();
		const status = vi.fn();
		const sync = new TournamentSync('/state', state(0), changed, status, 1000);
		const stop = sync.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(status).toHaveBeenLastCalledWith({ connected: false, lastSync: null });
		await vi.advanceTimersByTimeAsync(2000);
		expect(changed).toHaveBeenCalledWith(state(1));
		expect(status).toHaveBeenLastCalledWith({ connected: true, lastSync: 1000 });
		stop();
	});
	it('une réponse reçue après démontage ne modifie pas interface', async () => {
		vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
		let resolve!: (value: Response) => void;
		vi.stubGlobal('fetch', () => new Promise<Response>((done) => { resolve = done; }));
		const changed = vi.fn();
		const sync = new TournamentSync('/state', state(0), changed);
		const stop = sync.start();
		stop();
		resolve(Response.json({ state: state(1), serverNow: 1000 }));
		await new Promise((done) => setTimeout(done, 0));
		expect(changed).not.toHaveBeenCalled();
	});
});
