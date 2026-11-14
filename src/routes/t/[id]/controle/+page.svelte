<script lang="ts">
	import type { PageData } from './$types';
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
	import { TournamentSync } from '#lib/client/sync';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let live = $state<TournamentState>(data.state);
	let now = $state(Date.now());
	let pending = $state<string | null>(null);
	let message = $state<string | null>(null);
	let connected = $state(true);
	let lastSync = $state<number | null>(null);
	let retryCommand = $state<{ action: string; playerId?: string; minutes?: number; commandId: string; expectedRevision: number } | null>(null);
	let undo = $state<{ label: string; action: string; playerId?: string } | null>(null);
	let undoTimer: ReturnType<typeof setTimeout> | null = null;
	// svelte-ignore state_referenced_locally
	const sync = new TournamentSync(`/api/tournaments/${data.state.id}/state`, data.state,
		(next) => { if (next) live = next; },
		(status) => { connected = status.connected; lastSync = status.lastSync; }, 3000);
	// Replié par défaut si les places sont déjà tirées, pour garder les
	// éliminations à portée de pouce.
	// svelte-ignore state_referenced_locally
	let seatsOpen = $state(data.state.players.every((player) => player.seat === null));

	const view = $derived(computeClock(live.levels, live.clock, now));
	const rebuyRemaining = $derived(rebuyRemainingMs(live.rebuyDuration, live.clock, now));
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

	type TabId = 'clock' | 'players' | 'rebuy' | 'seats';
	const tabs: { id: TabId; label: string }[] = [
		{ id: 'clock', label: 'Horloge' },
		{ id: 'players', label: 'Joueurs' },
		{ id: 'rebuy', label: 'Recave' },
		{ id: 'seats', label: 'Table' }
	];
	const rebuyPresets = [0, 30, 60, 90, 120];
	// Sur téléphone, onglet Joueurs dès que la partie a démarré, sinon Horloge.
	// svelte-ignore state_referenced_locally
	let activeTab = $state<TabId>(data.state.clock ? 'players' : 'clock');
	let query = $state('');
	let sheetPlayerId = $state<string | null>(null);

	const normalizedQuery = $derived(query.trim().toLocaleLowerCase('fr'));
	const shownPlayers = $derived.by(() => {
		const needle = normalizedQuery;
		return [...live.players]
			.sort((a, b) => {
				const aOut = a.finishRank !== null;
				const bOut = b.finishRank !== null;
				if (aOut !== bOut) return aOut ? 1 : -1;
				if (aOut && bOut) return (b.finishRank ?? 0) - (a.finishRank ?? 0);
				return 0;
			})
			.filter((player) => !needle || player.name.toLocaleLowerCase('fr').includes(needle));
	});
	const sheetPlayer = $derived(live.players.find((player) => player.id === sheetPlayerId) ?? null);

	$effect(() => {
		const tick = setInterval(() => {
			now = sync.clock.now();
		}, 250);
		return () => clearInterval(tick);
	});

	$effect(() => sync.start());

	async function act(action: string, playerId?: string, minutes?: number, retry = false) {
		if (pending) return;
		pending = `${action}:${playerId ?? ''}`;
		message = null;
		const sent = performance.now();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const command = retry && retryCommand ? retryCommand : { action, playerId, minutes, commandId: crypto.randomUUID(), expectedRevision: live.revision };
		retryCommand = command;
		try {
			const response = await fetch(`/api/tournaments/${live.id}/action`, {
				method: 'POST',
				signal: controller.signal,
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(command)
			});
			const payload = await response.json();
			if (!response.ok) {
				retryCommand = null;
				message = payload.error ?? 'Action impossible.';
				if (response.status === 409) void sync.refresh();
			} else {
				retryCommand = null;
				sync.accept(payload, sent);
				now = sync.clock.now();
				if (action === 'draw_seats') seatsOpen = true;
				navigator.vibrate?.(18);
				if (action === 'eliminate' && playerId) {
					const player = live.players.find((entry) => entry.id === playerId);
					const rank = player?.finishRank;
					const place = rank ? ` · ${rank === 1 ? '1er' : `${rank}e`}` : '';
					announceUndo(`${playerLabel(playerId)} éliminé${place}`, 'cancel_elimination');
				} else if (action === 'rebuy' && playerId) {
					announceUndo(`Recave · ${playerLabel(playerId)}`, 'unrebuy', playerId);
				} else if (action === 'unrebuy' && playerId) {
					announceUndo(`Recave annulée · ${playerLabel(playerId)}`, 'rebuy', playerId);
				}
			}
		} catch {
			message = 'Réponse non reçue. Réessayez la même commande sans risque de double saisie.';
		} finally {
			clearTimeout(timeout);
			pending = null;
		}
	}

	function busy(action: string, playerId?: string): boolean {
		return pending === `${action}:${playerId ?? ''}`;
	}

	function playerLabel(playerId: string): string {
		const player = live.players.find((entry) => entry.id === playerId);
		return player ? formatPlayerName(player.name, player.entries, player.rebuyOrder) : 'Joueur';
	}

	function announceUndo(label: string, action: string, playerId?: string) {
		undo = { label, action, playerId };
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = setTimeout(() => {
			undo = null;
			undoTimer = null;
		}, 6000);
	}

	function undoLast() {
		if (!undo || pending) return;
		const command = undo;
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = null;
		undo = null;
		void act(command.action, command.playerId);
	}

	$effect(() => () => {
		if (undoTimer) clearTimeout(undoTimer);
	});

	$effect(() => {
		if (!sheetPlayerId) return;
		function onKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') closeSheet();
		}
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		window.addEventListener('keydown', onKeydown);
		return () => {
			window.removeEventListener('keydown', onKeydown);
			document.body.style.overflow = previousOverflow;
		};
	});

	function selectTab(tab: TabId) {
		activeTab = tab;
	}

	function tabKeydown(event: KeyboardEvent, index: number) {
		const offsets: Record<string, number> = {
			ArrowRight: 1,
			ArrowLeft: -1,
			Home: -index,
			End: tabs.length - 1 - index
		};
		const offset = offsets[event.key];
		if (offset === undefined) return;
		event.preventDefault();
		const target = (index + offset + tabs.length) % tabs.length;
		selectTab(tabs[target].id);
		const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
		buttons?.[target]?.focus();
	}

	function openSheet(playerId: string) {
		sheetPlayerId = playerId;
	}

	function closeSheet() {
		sheetPlayerId = null;
	}

	function sheetAction(action: string) {
		const player = sheetPlayer;
		closeSheet();
		if (player) void act(action, player.id);
	}

	function setRebuyDuration(minutes: number) {
		const duration = Math.max(0, Math.round(minutes));
		if (duration === live.rebuyDuration || pending !== null || live.status === 'finished') return;
		void act('set_rebuy_duration', undefined, duration);
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
		<a class="btn" href="/live" target="_blank" rel="noreferrer">Ouvrir l'écran TV</a>
		<a class="btn btn-gold" href="/t/{live.id}/cloture">Clôturer</a>
	</div>
</div>

{#if message}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{message}</p>
{/if}
{#if retryCommand && !pending}
	<button class="btn" onclick={() => { if (retryCommand) void act(retryCommand.action, retryCommand.playerId, retryCommand.minutes, true); }}>Réessayer la dernière commande</button>
{/if}
{#if !connected}
	<p class="notice notice-error" title={lastSync ? new Date(lastSync).toLocaleTimeString('fr-FR') : 'Jamais synchronisé'}>Connexion perdue · état potentiellement ancien.</p>
{/if}

<div class="control-top">
	<section class="remote-clock">
		<div class="remote-main">
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
		<div class="remote-aside stack" style="gap: 0.3rem; text-align: right;">
			<span class="small muted">
				<strong style="color: var(--text);">{live.remaining}</strong> restant{live.remaining === 1 ? '' : 's'}
			</span>
			<span class="small muted remote-detail">
				Stack moyen <strong style="color: var(--gold-soft);">{formatChips(live.averageStack)}</strong>
			</span>
			<span class="small muted remote-detail">{totalEntries} entrées · pool {formatEuro(pool)}</span>
			<span class="small muted remote-detail">Prochain : {formatBlinds(view.next)}</span>
		</div>
	</section>

	<div class="mobile-tabs" role="tablist" aria-label="Sections de contrôle">
		{#each tabs as tab, index (tab.id)}
			<button
				class="mobile-tab"
				class:active={activeTab === tab.id}
				role="tab"
				id={`tab-${tab.id}`}
				aria-selected={activeTab === tab.id}
				aria-controls={`panel-${tab.id}`}
				tabindex={activeTab === tab.id ? 0 : -1}
				onclick={() => selectTab(tab.id)}
				onkeydown={(event) => tabKeydown(event, index)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>

<div
	class="card control-panel panel-clock"
	class:panel-active={activeTab === 'clock'}
	id="panel-clock"
	role="tabpanel"
	aria-labelledby="tab-clock"
	style="margin-top: 1rem;"
>
	<div class="card-head"><h2>Horloge</h2></div>
	<div class="card-body stack">
		<div class="control-row">
			{#if view.status === 'idle'}
				<button class="btn btn-primary dock-dup" onclick={() => act('start')} disabled={pending !== null}>
					{busy('start') ? 'Démarrage…' : 'Démarrer'}
				</button>
			{:else if view.status === 'paused'}
				<button class="btn btn-primary dock-dup" onclick={() => act('resume')} disabled={pending !== null}>
					{busy('resume') ? '…' : 'Reprendre'}
				</button>
			{:else if view.status === 'running'}
				<button class="btn btn-gold dock-dup" onclick={() => act('pause')} disabled={pending !== null}>
					{busy('pause') ? '…' : 'Pause'}
				</button>
			{:else}
				<a class="btn btn-primary dock-dup" href="/t/{live.id}/cloture">Clôturer le tournoi</a>
			{/if}

			<button class="btn" onclick={() => act('prev')} disabled={pending !== null || view.status === 'idle'}>
				← Niveau précédent
			</button>
			<button class="btn dock-dup" onclick={() => act('next')} disabled={pending !== null || view.status === 'idle' || view.status === 'finished'}>
				Niveau suivant →
			</button>
			<button class="btn dock-dup" onclick={() => act('add_time', undefined, 1)} disabled={pending !== null || view.status === 'idle'}>
				+1 minute
			</button>
			<button class="btn dock-dup" onclick={() => act('add_time', undefined, -1)} disabled={pending !== null || view.status === 'idle' || view.status === 'finished'}>
				−1 minute
			</button>
		</div>
		{#if view.status === 'finished'}
			<p class="notice notice-info">
				L'horloge a atteint la fin de la structure. Il reste à saisir le classement final et à clôturer.
			</p>
		{/if}
		<div class="clock-stats mobile-only">
			<div class="clock-stat">
				<span class="small muted">Stack moyen</span>
				<strong>{formatChips(live.averageStack)}</strong>
			</div>
			<div class="clock-stat">
				<span class="small muted">Entrées</span>
				<strong>{totalEntries}</strong>
			</div>
			<div class="clock-stat">
				<span class="small muted">Pool</span>
				<strong>{formatEuro(pool)}</strong>
			</div>
			<div class="clock-stat">
				<span class="small muted">Prochain niveau</span>
				<strong>{formatBlinds(view.next)}</strong>
			</div>
		</div>
	</div>
</div>

<nav class="mobile-dock" aria-label="Commandes rapides">
	{#if view.status === 'idle'}
		<button class="btn btn-primary" onclick={() => act('start')} disabled={pending !== null}>
			{busy('start') ? '…' : 'Démarrer'}
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
		<a class="btn btn-primary" href="/t/{live.id}/cloture">Clôturer</a>
	{/if}
	<button class="btn" onclick={() => act('add_time', undefined, -1)} disabled={pending !== null || view.status === 'idle' || view.status === 'finished'}>
		−1 min
	</button>
	<button class="btn" onclick={() => act('add_time', undefined, 1)} disabled={pending !== null || view.status === 'idle'}>
		+1 min
	</button>
	<button class="btn" onclick={() => act('next')} disabled={pending !== null || view.status === 'idle' || view.status === 'finished'}>
		Niv. →
	</button>
</nav>

{#if undo}
	<div class="undo-toast" role="status" aria-live="polite">
		<span>{undo.label}</span>
		<button class="btn btn-sm" onclick={undoLast}>Annuler</button>
	</div>
{/if}

<div
	class="card control-panel panel-players"
	class:panel-active={activeTab === 'players'}
	id="panel-players"
	role="tabpanel"
	aria-labelledby="tab-players"
	style="margin-top: 1rem;"
>
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

		<div class="mobile-only">
			<label class="player-search-wrap">
				<span class="visually-hidden">Rechercher un joueur</span>
				<input
					class="player-search"
					type="search"
					placeholder="Rechercher un joueur…"
					autocomplete="off"
					bind:value={query}
				/>
			</label>
		</div>

		<div class="player-grid desktop-only">
			{#each activePlayers as player (player.id)}
				<div class="player-card">
					<div class="player-card-head">
						<span class="player-name">{formatPlayerName(player.name, player.entries, player.rebuyOrder)}</span>
						<div class="player-meta">
							<span class="badge badge-green">En jeu</span>
							{#if player.seat}
								<span class="badge">Place {player.seat}</span>
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

		<div class="mobile-only">
			{#if shownPlayers.length === 0}
				<p class="hint">
					{query.trim() ? `Aucun joueur ne correspond à « ${query.trim()} ».` : 'Aucun joueur dans ce tournoi.'}
				</p>
			{:else}
				<ul class="player-rows" aria-label="Joueurs du tournoi">
					{#each shownPlayers as player (player.id)}
						{@const out = player.finishRank !== null}
						<li class="player-row" class:out>
							<button
								class="player-row-main"
								onclick={() => openSheet(player.id)}
								aria-label={`Actions pour ${formatPlayerName(player.name, player.entries, player.rebuyOrder)}`}
							>
								<span class="player-row-rank">{out ? player.finishRank : '•'}</span>
								<span class="player-row-body">
									<span class="player-row-name">{formatPlayerName(player.name, player.entries, player.rebuyOrder)}</span>
									<span class="player-row-meta">
										{#if out}
											<span class="badge">Éliminé</span>
										{:else}
											<span class="badge badge-green">En jeu</span>
										{/if}
										{#if player.seat}
											<span class="badge">Place {player.seat}</span>
										{/if}
										{#if player.hands72 > 0}
											<span class="badge badge-green">{player.hands72} × 7-2</span>
										{/if}
										{#if player.entries > 1}
											<span class="badge">{player.entries} entrées</span>
										{/if}
									</span>
								</span>
								<span class="player-row-more" aria-hidden="true">⋯</span>
							</button>
							<div class="player-row-action">
								{#if out}
									<button
										class="btn btn-sm"
										onclick={() => act('rebuy', player.id)}
										disabled={pending !== null || live.status === 'finished'}
									>
										Réintégrer
									</button>
								{:else}
									<button
										class="btn btn-sm btn-danger"
										onclick={() => act('eliminate', player.id)}
										disabled={pending !== null || activePlayers.length <= 1 || live.status === 'finished'}
									>
										Éliminer
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if eliminatedPlayers.length > 0}
			<div class="desktop-only">
				<div class="divider"></div>
				<h3 class="small muted">
					{live.status === 'finished' ? 'Classement final' : 'Éliminés — du dernier sorti au premier'}
				</h3>
				<ul class="clean-list">
					{#each eliminatedPlayers as player (player.id)}
						<li>
							<span class="cluster">
								<span class="rank">{player.finishRank}</span>
								<span>{formatPlayerName(player.name, player.entries, player.rebuyOrder)}</span>
								{#if player.seat}
									<span class="badge">Place {player.seat}</span>
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
			</div>
		{/if}
	</div>
</div>

<div
	class="card control-panel panel-rebuy"
	class:panel-active={activeTab === 'rebuy'}
	id="panel-rebuy"
	role="tabpanel"
	aria-labelledby="tab-rebuy"
	style="margin-top: 1rem;"
>
	<div class="card-head">
		<h2>Recaves</h2>
		<span class="small muted">
			{#if rebuyRemaining === 0 || live.status === 'finished'}
				Recaves terminées
			{:else}
				Fin dans {formatClock(rebuyRemaining)}
			{/if}
		</span>
	</div>
	<div class="card-body stack mobile-only">
		<div class="rebuy-current">
			<span class="small muted">Durée des recaves</span>
			<strong>{live.rebuyDuration} min</strong>
			<span class="small muted">
				{#if rebuyRemaining === 0 || live.status === 'finished'}
					Recaves terminées
				{:else}
					Encore {formatClock(rebuyRemaining)}
				{/if}
			</span>
		</div>
		<div class="rebuy-presets" role="group" aria-label="Durées prédéfinies">
			{#each rebuyPresets as minutes (minutes)}
				<button
					class="btn btn-sm"
					class:btn-primary={live.rebuyDuration === minutes}
					aria-pressed={live.rebuyDuration === minutes}
					onclick={() => setRebuyDuration(minutes)}
					disabled={pending !== null || live.status === 'finished'}
				>
					{minutes === 0 ? 'Aucune' : `${minutes} min`}
				</button>
			{/each}
		</div>
		<div class="rebuy-stepper">
			<button
				class="btn"
				onclick={() => setRebuyDuration(live.rebuyDuration - 5)}
				disabled={pending !== null || live.status === 'finished' || live.rebuyDuration <= 0}
				aria-label="Retirer 5 minutes"
			>
				− 5 min
			</button>
			<span class="rebuy-value">{live.rebuyDuration} min</span>
			<button
				class="btn"
				onclick={() => setRebuyDuration(live.rebuyDuration + 5)}
				disabled={pending !== null || live.status === 'finished'}
				aria-label="Ajouter 5 minutes"
			>
				+ 5 min
			</button>
		</div>
		<p class="hint">
			Depuis le démarrage, pauses manuelles exclues. 0 pour aucune recave. Le réglage
			s'applique immédiatement.
		</p>
	</div>
	<form
		class="card-body stack desktop-only"
		onsubmit={(event) => {
			event.preventDefault();
			const form = new FormData(event.currentTarget);
			void act('set_rebuy_duration', undefined, Number(form.get('rebuy_duration')));
		}}
	>
		<label class="field">
			<span>Durée des recaves (minutes)</span>
			<input type="number" name="rebuy_duration" min="0" step="1" value={live.rebuyDuration} required disabled={live.status === 'finished'} />
			<span class="hint">Depuis le démarrage, pauses manuelles exclues. 0 pour aucune recave.</span>
		</label>
		<div class="cluster">
			<button class="btn" type="submit" disabled={pending !== null || live.status === 'finished'}>
				{busy('set_rebuy_duration') ? 'Enregistrement…' : 'Enregistrer la durée'}
			</button>
		</div>
	</form>
</div>

<div
	class="card control-panel panel-seats"
	class:panel-active={activeTab === 'seats'}
	id="panel-seats"
	role="tabpanel"
	aria-labelledby="tab-seats"
	style="margin-top: 1rem;"
>
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
				onclick={() => {
					if (seatedPlayers.length === 0 || confirm('Un nouveau tirage remplace le placement actuel. Continuer ?')) {
						act('draw_seats');
					}
				}}
				disabled={pending !== null || live.status === 'finished'}
			>
				{seatedPlayers.length > 0 ? 'Relancer le tirage' : 'Tirer au sort'}
			</button>
		</div>
	</div>
	{#if !seatsOpen && seatedPlayers.length > 0}
		<div class="card-body">
			<p class="small muted" style="margin: 0;">
				{seatedPlayers.map((player) => `${player.seat} ${formatPlayerName(player.name, player.entries, player.rebuyOrder)}`).join(' · ')}
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
								<span>{formatPlayerName(player.name, player.entries, player.rebuyOrder)}</span>
							</span>
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
</div>



<p class="small muted" style="margin-top: 1rem;">
	Astuce : gardez cet écran sur le téléphone de l'organisateur, et l'écran TV ouvert sur
	<a href="/live" target="_blank" rel="noreferrer">/live</a>. Cette URL fixe suit automatiquement la partie en cours.
</p>

<div class="dock-spacer" aria-hidden="true"></div>

{#if sheetPlayer}
	<button class="sheet-backdrop" type="button" aria-label="Fermer les actions" onclick={closeSheet}></button>
	<div class="player-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
		<div class="sheet-grab" aria-hidden="true"></div>
		<div class="sheet-head">
			<div>
				<h2 id="sheet-title">{formatPlayerName(sheetPlayer.name, sheetPlayer.entries, sheetPlayer.rebuyOrder)}</h2>
				<p class="small muted">
					{sheetPlayer.finishRank !== null
						? `Éliminé · ${sheetPlayer.finishRank === 1 ? '1er' : `${sheetPlayer.finishRank}e`}`
						: 'En jeu'}
					{sheetPlayer.seat ? ` · place ${sheetPlayer.seat}` : ''}
					{sheetPlayer.entries > 1 ? ` · ${sheetPlayer.entries} entrées` : ''}
				</p>
			</div>
			<button class="btn btn-sm btn-ghost" onclick={closeSheet}>Fermer</button>
		</div>
		<div class="sheet-actions">
			{#if sheetPlayer.finishRank === null}
				<button
					class="btn btn-danger"
					onclick={() => sheetAction('eliminate')}
					disabled={pending !== null || activePlayers.length <= 1 || live.status === 'finished'}
				>
					Éliminer
				</button>
				<button class="btn" onclick={() => sheetAction('rebuy')} disabled={pending !== null || live.status === 'finished'}>
					+ Recave
				</button>
				<button
					class="btn btn-ghost"
					onclick={() => sheetAction('unrebuy')}
					disabled={pending !== null || sheetPlayer.entries <= 1 || live.status === 'finished'}
				>
					− Recave
				</button>
			{:else}
				<button
					class="btn btn-primary"
					onclick={() => sheetAction('rebuy')}
					disabled={pending !== null || live.status === 'finished'}
				>
					Réintégrer (+ recave)
				</button>
			{/if}
			<button class="btn" onclick={() => sheetAction('hand72_add')} disabled={pending !== null}>+ 7-2</button>
			<button
				class="btn btn-ghost"
				onclick={() => sheetAction('hand72_remove')}
				disabled={pending !== null || sheetPlayer.hands72 <= 0}
			>
				− 7-2
			</button>
		</div>
	</div>
{/if}
