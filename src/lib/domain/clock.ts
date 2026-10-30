import type { ClockState, ClockView, Level } from './types';

export const MINUTE_MS = 60_000;

export function totalDurationMs(levels: Level[]): number {
	return levels.reduce((sum, level) => sum + Math.max(0, level.duration) * MINUTE_MS, 0);
}

export function levelStartMs(levels: Level[], index: number): number {
	return levels
		.slice(0, Math.max(0, index))
		.reduce((sum, level) => sum + Math.max(0, level.duration) * MINUTE_MS, 0);
}

export function clockElapsedMs(clock: ClockState | null, now: number): number {
	if (!clock) return 0;
	const until = clock.pausedAt ?? now;
	return Math.max(0, until - clock.startedAt - clock.pausedTotalMs + clock.offsetMs);
}

/**
 * Temps réellement joué, pauses exclues, sans tenir compte des sauts de niveau
 * ou des minutes ajoutées. Sert aux échéances de tournoi comme la fin des
 * recaves, qui suivent l'horloge murale et non la progression des blindes.
 */
export function playElapsedMs(clock: ClockState | null, now: number): number {
	if (!clock) return 0;
	const until = clock.pausedAt ?? now;
	return Math.max(0, until - clock.startedAt - clock.pausedTotalMs);
}

export function rebuyRemainingMs(
	durationMinutes: number,
	clock: ClockState | null,
	now: number
): number {
	return Math.max(0, durationMinutes * MINUTE_MS - playElapsedMs(clock, now));
}

export function computeClock(
	levels: Level[],
	clock: ClockState | null,
	now: number
): ClockView {
	const totalMs = totalDurationMs(levels);

	if (!clock || levels.length === 0) {
		return {
			status: 'idle',
			index: -1,
			level: null,
			next: levels[0] ?? null,
			elapsedMs: 0,
			remainingMs: 0,
			durationMs: 0,
			levelStartMs: 0,
			totalMs,
			progress: 0
		};
	}

	const elapsedMs = Math.min(totalMs, clockElapsedMs(clock, now));

	if (elapsedMs >= totalMs) {
		const index = levels.length - 1;
		const durationMs = Math.max(0, levels[index].duration) * MINUTE_MS;
		return {
			status: 'finished',
			index,
			level: levels[index],
			next: null,
			elapsedMs,
			remainingMs: 0,
			durationMs,
			levelStartMs: totalMs - durationMs,
			totalMs,
			progress: 1
		};
	}

	let start = 0;
	for (let i = 0; i < levels.length; i++) {
		const durationMs = Math.max(0, levels[i].duration) * MINUTE_MS;
		const isLast = i === levels.length - 1;
		if (elapsedMs < start + durationMs || isLast) {
			return {
				status: clock.pausedAt !== null ? 'paused' : 'running',
				index: i,
				level: levels[i],
				next: levels[i + 1] ?? null,
				elapsedMs,
				remainingMs: Math.max(0, start + durationMs - elapsedMs),
				durationMs,
				levelStartMs: start,
				totalMs,
				progress: durationMs > 0 ? Math.min(1, Math.max(0, (elapsedMs - start) / durationMs)) : 0
			};
		}
		start += durationMs;
	}

	// Inatteignable, mais TypeScript a besoin d'un retour.
	return {
		status: 'finished',
		index: levels.length - 1,
		level: levels[levels.length - 1],
		next: null,
		elapsedMs: totalMs,
		remainingMs: 0,
		durationMs: 0,
		levelStartMs: totalMs,
		totalMs,
		progress: 1
	};
}

export function startClock(now: number): ClockState {
	return { startedAt: now, pausedAt: null, pausedTotalMs: 0, offsetMs: 0 };
}

export function pauseClock(clock: ClockState | null, now: number): ClockState | null {
	if (!clock || clock.pausedAt !== null) return clock;
	return { ...clock, pausedAt: now };
}

export function resumeClock(clock: ClockState | null, now: number): ClockState | null {
	if (!clock || clock.pausedAt === null) return clock;
	return {
		...clock,
		pausedTotalMs: clock.pausedTotalMs + (now - clock.pausedAt),
		pausedAt: null
	};
}

export function jumpToLevel(
	levels: Level[],
	clock: ClockState | null,
	now: number,
	targetIndex: number
): ClockState | null {
	if (!clock) return clock;
	const index = Math.max(0, Math.min(levels.length - 1, targetIndex));
	const target = levelStartMs(levels, index);
	const elapsed = clockElapsedMs(clock, now);
	return { ...clock, offsetMs: clock.offsetMs + (target - elapsed) };
}

export function nextLevel(
	levels: Level[],
	clock: ClockState | null,
	now: number
): ClockState | null {
	if (!clock) return clock;
	const view = computeClock(levels, clock, now);
	if (view.status === 'finished' || view.index < 0) return clock;
	const target = view.levelStartMs + view.durationMs;
	return { ...clock, offsetMs: clock.offsetMs + (target - view.elapsedMs) };
}

export function previousLevel(
	levels: Level[],
	clock: ClockState | null,
	now: number
): ClockState | null {
	if (!clock) return clock;
	const view = computeClock(levels, clock, now);
	if (view.index < 0) return clock;
	const target = levelStartMs(levels, Math.max(0, view.index - 1));
	return { ...clock, offsetMs: clock.offsetMs + (target - view.elapsedMs) };
}

export function addTime(clock: ClockState | null, ms: number): ClockState | null {
	if (!clock) return clock;
	return { ...clock, offsetMs: clock.offsetMs - ms };
}

export function formatClock(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatBlinds(level: Level | null): string {
	if (!level) return '—';
	if (level.break) return level.label ?? 'Pause';
	return `${level.sb.toLocaleString('fr-FR')} / ${level.bb.toLocaleString('fr-FR')}`;
}

export function formatAnte(level: Level | null): string {
	return level && level.ante > 0 ? `Ante ${level.ante.toLocaleString('fr-FR')}` : '';
}

export function levelLabel(level: Level | null, index: number): string {
	if (!level) return '—';
	if (level.break) return level.label ?? 'Pause';
	return `Niveau ${index + 1}`;
}
