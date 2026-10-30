<script lang="ts">
	import type { PageData } from './$types';
	import type { TournamentState } from '#lib/domain/types';
	import TournamentScreen from '#lib/TournamentScreen.svelte';
	import { TournamentSync } from '#lib/client/sync';
	import { keepScreenAwake } from '#lib/client/screen';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let current = $state<TournamentState | null>(data.state);
	let connected = $state(true);
	let lastSync = $state<number | null>(null);
	// svelte-ignore state_referenced_locally
	const sync = new TournamentSync('/api/tournaments/current/state', data.state,
		(next) => { current = next; },
		(status) => { connected = status.connected; lastSync = status.lastSync; });
	$effect(() => sync.start());
	$effect(() => keepScreenAwake());
</script>

<svelte:head><title>{current ? `${current.name} — Horloge` : 'Horloge TV'} · Poker Clock</title></svelte:head>

{#if !connected}
	<div class="screen-connection" title={lastSync ? new Date(lastSync).toLocaleTimeString('fr-FR') : 'Jamais synchronisé'}>Hors ligne · dernière horloge connue</div>
{/if}
{#if current}
	<TournamentScreen tournament={current} poll={false} timeSource={sync.clock} />
{:else}
	<div class="screen-body">
		<div class="screen-main">
			<div class="screen-level">En attente d'un tournoi</div>
			<div class="screen-time">--:--</div>
			<p class="muted">La prochaine partie s'affichera automatiquement ici.</p>
		</div>
	</div>
{/if}
