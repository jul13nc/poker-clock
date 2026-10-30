/** Propriétaire du Wake Lock : libération au démontage et nouvelle demande après veille. */
export function keepScreenAwake() {
	let lock: WakeLockSentinel | null = null;
	let requesting = false;
	let stopped = false;
	async function request() {
		if (stopped || requesting || lock || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
		requesting = true;
		try {
			const next = await navigator.wakeLock.request('screen');
			if (stopped) { await next.release(); return; }
			lock = next;
			next.addEventListener('release', () => { if (lock === next) lock = null; });
		} catch { /* Fonction facultative selon navigateur et permissions. */ }
		finally { requesting = false; }
	}
	void request();
	document.addEventListener('visibilitychange', request);
	return () => { stopped = true; document.removeEventListener('visibilitychange', request); void lock?.release(); };
}
