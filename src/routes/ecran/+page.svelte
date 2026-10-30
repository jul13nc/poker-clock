<script lang="ts">
	import type { PageData } from './$types';
	import type { TournamentState } from '#lib/domain/types';
	import TournamentScreen from '#lib/TournamentScreen.svelte';

	let { data }: { data: PageData } = $props();
	// svelte-ignore state_referenced_locally
	let current = $state<TournamentState | null>(data.state);

	$effect(() => {
		let active = true;
		let pending = false;
		async function refresh() {
			if (pending) return;
			pending = true;
			try {
				const response = await fetch('/api/tournaments/current/state', { cache: 'no-store' });
				if (response.ok) {
					const payload = await response.json() as { state: TournamentState | null };
					if (active) current = payload.state;
				}
			} catch {
				// Hors ligne : conserver la dernière horloge connue.
			} finally {
				pending = false;
			}
		}
		const timer = setInterval(refresh, 4000);
		const onVisibility = () => {
			if (document.visibilityState === 'visible') void refresh();
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			active = false;
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<svelte:head><title>{current ? `${current.name} — Horloge` : 'Horloge TV'} · Poker Clock</title></svelte:head>

{#if current}
	<TournamentScreen tournament={current} poll={false} />
{:else}
	<div class="screen-body">
		<div class="screen-main">
			<div class="screen-level">En attente d'un tournoi</div>
			<div class="screen-time">--:--</div>
			<p class="muted">La prochaine partie s'affichera automatiquement ici.</p>
		</div>
	</div>
{/if}
