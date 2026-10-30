import type { TournamentState } from '#lib/domain/types';

export type StateResponse = { state: TournamentState | null; serverNow: number };

export class ServerClock {
	private server = Date.now();
	private sampled = performance.now();
	now() { return this.server + performance.now() - this.sampled; }
	calibrate(serverNow: number, sent: number, received = performance.now()) {
		this.server = serverNow + Math.max(0, received - sent) / 2;
		this.sampled = received;
	}
}

export type SyncStatus = { connected: boolean; lastSync: number | null };

/** Un seul GET actif, états monotones et temps serveur commun à toutes les vues. */
export class TournamentSync {
	readonly clock = new ServerClock();
	private current: TournamentState | null;
	private controller: AbortController | null = null;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private stopped = true;
	private failures = 0;
	private generation = 0;
	private etag: string | null = null;
	private lastServerNow = -Infinity;
	constructor(
		private url: string,
		initial: TournamentState | null,
		private changed: (state: TournamentState | null) => void,
		private status: (status: SyncStatus) => void = () => {},
		private interval = 4000
	) { this.current = initial; }

	accept(payload: StateResponse, sent: number, etag: string | null = null) {
		if (!Number.isFinite(payload.serverNow) || payload.serverNow < this.lastServerNow) return false;
		if (this.current && payload.state?.id === this.current.id && payload.state.revision < this.current.revision) return false;
		this.lastServerNow = payload.serverNow;
		this.clock.calibrate(payload.serverNow, sent);
		this.current = payload.state;
		this.etag = etag;
		this.changed(payload.state);
		this.status({ connected: true, lastSync: payload.serverNow });
		return true;
	}

	start() {
		this.stopped = false;
		void this.refresh();
		document.addEventListener('visibilitychange', this.visible);
		window.addEventListener('online', this.online);
		return () => this.stop();
	}
	private visible = () => { if (document.visibilityState === 'visible') this.online(); };
	private online = () => { this.controller?.abort(); this.generation++; this.controller = null; void this.refresh(); };
	stop() {
		this.stopped = true;
		this.generation++;
		this.controller?.abort();
		this.controller = null;
		if (this.timer) clearTimeout(this.timer);
		document.removeEventListener('visibilitychange', this.visible);
		window.removeEventListener('online', this.online);
	}

	async refresh() {
		if (this.stopped || this.controller) return;
		if (this.timer) clearTimeout(this.timer);
		const generation = ++this.generation;
		const controller = new AbortController();
		this.controller = controller;
		const timeout = setTimeout(() => controller.abort(), 8000);
		const sent = performance.now();
		try {
			const response = await fetch(this.url, {
				cache: 'no-store', signal: controller.signal,
				headers: this.etag ? { 'if-none-match': this.etag } : {}
			});
			if (this.stopped || generation !== this.generation) return;
			if (response.status === 304) {
				const serverNow = Number(response.headers.get('x-server-now'));
				if (serverNow > 0) this.accept({ state: this.current, serverNow }, sent, this.etag);
			} else {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const payload: StateResponse = await response.json();
				if (!this.stopped && generation === this.generation) this.accept(payload, sent, response.headers.get('etag'));
			}
			this.failures = 0;
		} catch {
			if (!this.stopped && generation === this.generation) {
				this.failures++;
				this.status({ connected: false, lastSync: Number.isFinite(this.lastServerNow) ? this.lastServerNow : null });
			}
		} finally {
			clearTimeout(timeout);
			if (generation === this.generation) {
				this.controller = null;
				if (!this.stopped) this.timer = setTimeout(() => void this.refresh(), Math.min(30_000, this.interval * 2 ** this.failures));
			}
		}
	}
}
