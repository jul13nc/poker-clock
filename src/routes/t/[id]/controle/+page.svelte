<script lang="ts">
	import type { PageData } from './$types';
	import {
		computeClock,
		formatAnte,
		formatBlinds,
		formatClock,
		levelLabel
	} from '#lib/domain/clock';
	import type { TournamentState } from '#lib/domain/types';
	import { formatChips, formatEuro } from '#lib/domain/format';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let live = $state<TournamentState>(data.state);
	let now = $state(Date.now());
	let pending = $state<string | null>(null);
	let message = $state<string | null>(null);
	// Replié par défaut si les places sont déjà tirées, pour garder les
	// éliminations à portée de pouce.
	// svelte-ignore state_referenced_locally
	let seatsOpen = $state(data.state.players.every((player) => player.seat === null));

	const view = $derived(computeClock(live.levels, live.clock, now));
	const totalEntries = $derived(live.players.reduce((sum, player) => sum + player.entries, 0));
	const pool = $derived(live.buyIn * totalEntries);
	const activePlayers = $derived(live.players.filter((player) => player.finishRank === null));
	const eliminatedPlayers = $derived(
		live.players
			.filter((player) => player.finishRank !== null)
			.sort((a, b) => (b.finishRank ?? 0) - (a.finishRank ?? 0))
	);
	const seatedPlayers = $derived(
		[...live.players]
			.filter((player) => player.seat !== null)
			.sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
	);

	$effect(() => {
		const tick = setInterval(() => {
			now = Date.now();
		}, 250);
		return () => clearInterval(tick);
	});

	$effect(() => {
		const poll = setInterval(async () => {
			if (pending) return;
			try {
				const response = await fetch(`/api/tournaments/${live.id}/state`, {
					cache: 'no-store'
				});
				if (response.ok) live = (await response.json()) as TournamentState;
			} catch {
				// ignore
			}
		}, 3000);
		return () => clearInterval(poll);
	});

	async function act(action: string, playerId?: string, minutes?: number) {
		if (pending) return;
		pending = `${action}:${playerId ?? ''}`;
		message = null;
		try {
			const response = await fetch(`/api/tournaments/${live.id}/action`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, playerId, minutes })
			});
			const payload = await response.json();
			if (!response.ok) {
				message = payload.error ?? 'Action impossible.';
			} else {
				live = payload as TournamentState;
				now = Date.now();
				if (action === 'draw_seats') seatsOpen = true;
			}
		} catch {
			message = 'Connexion perdue. Réessayez.';
		} finally {
			pending = null;
		}
	}

	function busy(action: string, playerId?: string): boolean {
		return pending === `${action}:${playerId ?? ''}`;
	}
</script>

<svelte:head>
	<title>Contrôle · {live.name}</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{live.seasonName}</p>
		<h1>Contrôle du tournoi</h1>
		<p class="muted">{live.name} · {live.multiplier === 2 ? 'journée double' : 'journée normale'}</p>
	</div>
	<div class="cluster">
		<a class="btn" href="/t/{live.id}/ecran" target="_blank" rel="noreferrer">Ouvrir l'écran TV</a>
		<a class="btn btn-gold" href="/t/{live.id}/cloture">Clôturer</a>
	</div>
</div>

{#if message}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{message}</p>
{/if}

<section class="remote-clock">
	<div>
		<div class="remote-level">
			{view.status === 'idle' ? 'En attente' : levelLabel(view.level, view.index)}
			{#if view.status === 'paused'} · pause{/if}
			{#if view.status === 'finished'} · terminé{/if}
		</div>
		<div class="remote-time">{view.status === 'idle' ? '--:--' : formatClock(view.remainingMs)}</div>
		<div class="small muted">
			{formatBlinds(view.level)}
			{#if formatAnte(view.level)} · {formatAnte(view.level)}{/if}
		</div>
	</div>
	<div class="stack" style="gap: 0.3rem; text-align: right;">
		<span class="small muted">
			<strong style="color: var(--text);">{live.remaining}</strong> restant{live.remaining === 1 ? '' : 's'}
			· stack moyen <strong style="color: var(--gold-soft);">{formatChips(live.averageStack)}</strong>
		</span>
		<span class="small muted">{totalEntries} entrées · pool {formatEuro(pool)}</span>
		<span class="small muted">Prochain : {formatBlinds(view.next)}</span>
	</div>
</section>

<section class="card" style="margin-top: 1rem;">
	<div class="card-head"><h2>Horloge</h2></div>
	<div class="card-body stack">
		<div class="control-row">
			{#if view.status === 'idle'}
				<button class="btn btn-primary" onclick={() => act('start')} disabled={pending !== null}>
					{busy('start') ? 'Démarrage…' : 'Démarrer'}
				</button>
			{:else if view.status === 'paused'}
				<button class="btn btn-primary" onclick={() => act('resume')} disabled={pending !== null}>
					{busy('resume') ? '…' : 'Reprendre'}
				</button>
			{:else if view.status === 'running'}
				<button class="btn btn-gold" onclick={() => act('pause')} disabled={pending !== null}>
					{busy('pause') ? '…' : 'Pause'}
				</button>
			{:else}
				<a class="btn btn-primary" href="/t/{live.id}/cloture">Clôturer le tournoi</a>
			{/if}

			<button class="btn" onclick={() => act('prev')} disabled={pending !== null || view.status === 'idle'}>
				← Niveau précédent
			</button>
			<button class="btn" onclick={() => act('next')} disabled={pending !== null || view.status === 'idle' || view.status === 'finished'}>
				Niveau suivant →
			</button>
			<button class="btn" onclick={() => act('add_time', undefined, 1)} disabled={pending !== null || view.status === 'idle'}>
				+1 minute
			</button>
		</div>
		{#if view.status === 'finished'}
			<p class="notice notice-info">
				L'horloge a atteint la fin de la structure. Il reste à saisir le classement final et à clôturer.
			</p>
		{/if}
	</div>
</section>

<section class="card" style="margin-top: 1rem;">
	<div class="card-head">
		<h2>Placement à table</h2>
		<div class="cluster">
			{#if seatedPlayers.length > 0}
				<button
					class="btn btn-sm btn-ghost"
					onclick={() => (seatsOpen = !seatsOpen)}
					aria-expanded={seatsOpen}
				>
					{seatsOpen ? 'Réduire' : 'Afficher les places'}
				</button>
				<a
					class="btn btn-sm btn-ghost"
					href="/t/{live.id}/ecran?places=1"
					target="_blank"
					rel="noreferrer"
				>
					Afficher sur la TV
				</a>
			{/if}
			<button
				class="btn btn-sm btn-gold"
				onclick={() => act('draw_seats')}
				disabled={pending !== null || live.status === 'finished'}
			>
				{seatedPlayers.length > 0 ? 'Relancer le tirage' : 'Tirer au sort'}
			</button>
		</div>
	</div>
	{#if !seatsOpen && seatedPlayers.length > 0}
		<div class="card-body">
			<p class="small muted" style="margin: 0;">
				{seatedPlayers.map((player) => `${player.seat} ${player.name}`).join(' · ')}
			</p>
		</div>
	{:else}
		<div class="card-body">
			{#if seatedPlayers.length === 0}
				<p class="hint">
					Tirez les places au sort avant le début de la soirée : chacun saura où s'asseoir, et
					l'écran TV affichera le plan de table.
				</p>
			{:else}
				<ol class="clean-list">
					{#each seatedPlayers as player (player.id)}
						<li>
							<span class="cluster">
								<span class="seat-badge">{player.seat}</span>
								<span>{player.name}</span>
							</span>
							{#if player.entries > 1}
								<span class="badge badge-gold">{player.entries - 1} recave{player.entries - 1 > 1 ? 's' : ''}</span>
							{/if}
						</li>
					{/each}
				</ol>
				<p class="hint" style="margin-top: 0.7rem;">
					Un nouveau tirage remplace le précédent. L'écran TV bascule automatiquement sur le
					plan de table tant que l'horloge n'a pas démarré.
				</p>
			{/if}
		</div>
	{/if}
</section>

<section class="card" style="margin-top: 1rem;">
	<div class="card-head">
		<h2>Éliminations</h2>
		<span class="small muted">
			{activePlayers.length} en jeu · {eliminatedPlayers.length} éliminé{eliminatedPlayers.length > 1 ? 's' : ''}
		</span>
	</div>
	<div class="card-body stack">
		<div class="cluster">
			<button
				class="btn btn-sm"
				onclick={() => act('cancel_elimination')}
				disabled={pending !== null || eliminatedPlayers.length === 0 || live.status === 'finished'}
			>
				Annuler la dernière élimination
			</button>
			<a class="btn btn-sm btn-ghost" href="/t/{live.id}/synthese">Synthèse du jour</a>
		</div>
		<p class="hint">
			Chaque élimination attribue la dernière place libre. La recave d'un joueur éliminé le
			remet en jeu et recalcule les places.
		</p>

		<div class="player-grid">
			{#each activePlayers as player (player.id)}
				<div class="player-card">
					<div class="player-card-head">
						<span class="player-name">{player.name}</span>
						<div class="player-meta">
							<span class="badge badge-green">En jeu</span>
							{#if player.seat}
								<span class="badge">Place {player.seat}</span>
							{/if}
							{#if player.entries > 1}
								<span class="badge badge-gold">{player.entries - 1} recave{player.entries - 1 > 1 ? 's' : ''}</span>
							{/if}
							{#if player.hands72 > 0}
								<span class="badge badge-green">{player.hands72} × 7-2</span>
							{/if}
						</div>
					</div>

					<div class="player-actions">
						<button
							class="btn btn-sm btn-danger"
							style="grid-column: 1 / -1;"
							onclick={() => act('eliminate', player.id)}
							disabled={pending !== null || activePlayers.length <= 1 || live.status === 'finished'}
						>
							Éliminer
						</button>
						<button
							class="btn btn-sm"
							onclick={() => act('rebuy', player.id)}
							disabled={pending !== null || live.status === 'finished'}
						>
							+ Recave
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => act('unrebuy', player.id)}
							disabled={pending !== null || player.entries <= 1 || live.status === 'finished'}
						>
							− Recave
						</button>
						<button
							class="btn btn-sm"
							onclick={() => act('hand72_add', player.id)}
							disabled={pending !== null}
						>
							+ 7-2
						</button>
						<button
							class="btn btn-sm btn-ghost"
							onclick={() => act('hand72_remove', player.id)}
							disabled={pending !== null || player.hands72 <= 0}
						>
							− 7-2
						</button>
					</div>
				</div>
			{/each}
		</div>

		{#if eliminatedPlayers.length > 0}
			<div class="divider"></div>
			<h3 class="small muted">
				{live.status === 'finished' ? 'Classement final' : 'Éliminés — du dernier sorti au premier'}
			</h3>
			<ul class="clean-list">
				{#each eliminatedPlayers as player (player.id)}
					<li>
						<span class="cluster">
							<span class="rank">{player.finishRank}</span>
							<span>{player.name}</span>
							{#if player.seat}
								<span class="badge">Place {player.seat}</span>
							{/if}
							{#if player.entries > 1}
								<span class="badge badge-gold">{player.entries - 1} recave{player.entries - 1 > 1 ? 's' : ''}</span>
							{/if}
						</span>
						<span class="cluster">
							{#if player.hands72 > 0}
								<span class="badge badge-green">{player.hands72} × 7-2</span>
							{/if}
							<button
								class="btn btn-sm"
								onclick={() => act('rebuy', player.id)}
								disabled={pending !== null || live.status === 'finished'}
							>
								+ Recave (réintégrer)
							</button>
							<button
								class="btn btn-sm btn-ghost"
								onclick={() => act('hand72_add', player.id)}
								disabled={pending !== null}
							>
								+ 7-2
							</button>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

<p class="small muted" style="margin-top: 1rem;">
	Astuce : gardez cet écran sur le téléphone de l'organisateur, et l'écran TV ouvert sur
	<a href="/t/{live.id}/ecran" target="_blank" rel="noreferrer">/t/{live.id}/ecran</a>. L'horloge se synchronise toutes les 3 secondes.
</p>
