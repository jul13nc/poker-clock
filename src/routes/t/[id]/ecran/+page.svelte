<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import {
		computeClock,
		formatAnte,
		formatBlinds,
		formatClock,
		levelLabel,
		rebuyRemainingMs
	} from '#lib/domain/clock';
	import type { TournamentState } from '#lib/domain/types';
	import { formatChips, formatEuro, formatPlayerName } from '#lib/domain/format';
	import { buildLiveRanking } from '#lib/domain/tournament';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let live = $state<TournamentState>(data.state);
	let now = $state(Date.now());
	let soundEnabled = $state(false);

	// « auto » : les places s'affichent tant que l'horloge n'a pas démarré.
	let viewMode = $state<'auto' | 'clock' | 'seats'>(
		page.url.searchParams.has('places') ? 'seats' : 'auto'
	);

	let audio: AudioContext | null = null;
	let lastLevel = -1;
	let wakeLock: { release: () => Promise<void> } | null = null;

	const view = $derived(computeClock(live.levels, live.clock, now));
	const rebuyRemaining = $derived(rebuyRemainingMs(live.rebuyDuration, live.clock, now));

	const leader72 = $derived(
		[...live.players].sort((a, b) => b.hands72 - a.hands72)[0] ?? null
	);

	const seated = $derived(
		[...live.players]
			.filter((player) => player.seat !== null)
			.sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
	);
	const hasSeats = $derived(seated.length > 0);
	const autoSeats = $derived(live.clock === null && hasSeats);
	const seatsVisible = $derived(viewMode === 'seats' || (viewMode === 'auto' && autoSeats));

	// Seules les places déjà attribuées affichent un nom ; les places encore en
	// jeu restent vides, avec le gain éventuel de la place. Le dernier joueur en
	// lice apparaît en 1re place.
	const liveRanking = $derived(buildLiveRanking(live.players, live.payouts));

	const upcoming = $derived(
		live.levels
			.slice(view.index + 1, view.index + 9)
			.map((level, offset) => ({ level, index: view.index + 1 + offset }))
	);

	function toggleSeats() {
		viewMode = seatsVisible ? 'clock' : 'seats';
	}

	$effect(() => {
		const tick = setInterval(() => {
			now = Date.now();
		}, 250);

		const poll = setInterval(async () => {
			try {
				const response = await fetch(`/api/tournaments/${live.id}/state`, {
					cache: 'no-store'
				});
				if (response.ok) {
					live = (await response.json()) as TournamentState;
				}
			} catch {
				// hors ligne : l'horloge continue de tourner localement
			}
		}, 4000);

		return () => {
			clearInterval(tick);
			clearInterval(poll);
		};
	});

	$effect(() => {
		const index = view.index;
		if (lastLevel >= 0 && index > lastLevel && view.status === 'running') {
			beep(3);
		}
		lastLevel = index;
	});

	$effect(() => {
		void keepAwake();
		const onVisibility = () => {
			if (document.visibilityState === 'visible') void keepAwake();
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	});

	function enableSound() {
		if (!audio) {
			audio = new AudioContext();
		}
		void audio.resume();
		soundEnabled = true;
		beep(1);
	}

	function beep(times: number) {
		if (!audio) return;
		for (let i = 0; i < times; i++) {
			const oscillator = audio.createOscillator();
			const gain = audio.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.value = 880;
			gain.gain.value = 0.12;
			oscillator.connect(gain).connect(audio.destination);
			const start = audio.currentTime + i * 0.28;
			oscillator.start(start);
			oscillator.stop(start + 0.18);
		}
	}

	async function keepAwake() {
		const nav = navigator as Navigator & {
			wakeLock?: { request(type: 'screen'): Promise<{ release: () => Promise<void> }> };
		};
		if (!nav.wakeLock) return;
		try {
			wakeLock = await nav.wakeLock.request('screen');
		} catch {
			// certains navigateurs refusent sans interaction
		}
	}

	async function toggleFullscreen() {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		} else {
			await document.documentElement.requestFullscreen();
		}
	}
</script>

<svelte:head>
	<title>{live.name} — Horloge · Poker Clock</title>
</svelte:head>

<div class="screen-body">
	{#if seatsVisible}
		<div class="screen-main">
			<div class="screen-level">Placement à table</div>
			{#if hasSeats}
				<p class="muted seat-legend">Numéro 1 au bouton, ensuite dans le sens horaire.</p>
				<div class="seat-board">
					<div class="seat-grid">
						{#each seated as player (player.id)}
							<div class="seat-card">
								<span class="seat-number">{player.seat}</span>
								<span class="seat-name">{formatPlayerName(player.name, player.entries, player.rebuyOrder)}</span>
							</div>
						{/each}
					</div>
				</div>
				<p class="muted" style="margin-top: 1rem;">
					Tirage au sort · {seated.length} joueur{seated.length > 1 ? 's' : ''}
				</p>
			{:else}
				<p class="muted" style="margin-top: 1rem;">
					Aucun tirage au sort pour l'instant. L'organisateur peut le lancer depuis le contrôle.
				</p>
			{/if}
		</div>
	{:else}
		<div class="screen-main screen-main-stage">
			<div class="screen-stage">
				<aside class="screen-side">
					<p class="screen-side-title">Classement</p>
					<ol class="live-ranking">
						{#each liveRanking as row (row.place)}
							<li class="live-row" class:is-empty={row.player === null}>
								<span class="live-place">{row.place}</span>
								<span class="live-name">{row.player ? formatPlayerName(row.player.name, row.player.entries, row.player.rebuyOrder) : '—'}</span>
								{#if row.prize > 0}
									<span class="live-prize">{formatEuro(row.prize)}</span>
								{/if}
							</li>
						{/each}
					</ol>
				</aside>

				<div class="screen-center">
					{#if view.status === 'idle'}
						<div class="screen-level">Prêt à jouer</div>
						<div class="screen-time">--:--</div>
						<p class="muted">L'horloge démarrera depuis le contrôle organisateur.</p>
					{:else}
						<div class="screen-level" class:break-label={view.level?.break}>
							{levelLabel(view.level, view.index)}
							{#if view.status === 'paused'} · en pause{/if}
						</div>

						<div
							class="screen-time"
							class:is-warning={view.remainingMs <= 60_000 && view.status !== 'finished'}
						>
							{formatClock(view.remainingMs)}
						</div>

						<div class="screen-blinds">{formatBlinds(view.level)}</div>
						{#if formatAnte(view.level)}
							<div class="screen-ante">{formatAnte(view.level)}</div>
						{/if}

						{#if view.status === 'finished'}
							<div class="screen-next">
								<strong>Horloge terminée</strong> — clôturez le tournoi
							</div>
						{/if}
					{/if}

					<div class="screen-rebuy" class:is-closed={rebuyRemaining === 0 || live.status === 'finished'}>
						{#if rebuyRemaining === 0 || live.status === 'finished'}
							Recaves terminées
						{:else}
							Fin des recaves dans <strong>{formatClock(rebuyRemaining)}</strong>
						{/if}
					</div>

					{#if live.status === 'finished'}
						<div class="screen-stats">
							<span>Tournoi terminé</span>
						</div>
					{:else}
						<div class="screen-stats">
							<span class="screen-count">
								<strong>{live.remaining}/{live.players.length}</strong>
							</span>
							<span>Moy: <strong>{formatChips(live.averageStack)}</strong></span>
						</div>
					{/if}

					{#if view.status === 'finished'}
						<div class="badge badge-gold" style="margin-top: 1rem;">Tournoi à clôturer</div>
					{/if}
				</div>

				<aside class="screen-side">
					<p class="screen-side-title">Blindes à venir</p>
					<ol class="upcoming-list">
						{#each upcoming as item (item.index)}
							<li class="upcoming-row" class:is-break={item.level.break}>
								<span class="upcoming-blinds">{formatBlinds(item.level)}</span>
							</li>
						{:else}
							<li class="upcoming-empty">Fin de structure</li>
						{/each}
					</ol>
				</aside>
			</div>
		</div>
	{/if}

	<div class="screen-foot">
		<span>
			{live.players.length} joueur{live.players.length > 1 ? 's' : ''}
			· buy-in {live.buyIn} €
			· {live.players.reduce((sum, player) => sum + player.entries, 0)} entrée{live.players.reduce((sum, player) => sum + player.entries, 0) > 1 ? 's' : ''}
		</span>
		{#if leader72 && leader72.hands72 > 0}
			<span>7-2 : <strong style="color: var(--gold-soft);">{formatPlayerName(leader72.name, leader72.entries, leader72.rebuyOrder)}</strong> ({leader72.hands72})</span>
		{/if}
		<a class="hidden-link" href="/t/{live.id}/controle">Contrôle</a>
	</div>

	<div class="screen-controls">
		<button class="btn btn-sm" onclick={toggleSeats}>
			{seatsVisible ? 'Horloge' : 'Places à table'}
		</button>
		<button class="btn btn-sm" onclick={toggleFullscreen}>Plein écran</button>
		<button class="btn btn-sm" class:btn-gold={!soundEnabled} onclick={enableSound}>
			{soundEnabled ? 'Son actif' : 'Activer le son'}
		</button>
	</div>
</div>
