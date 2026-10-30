<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateFr, formatEuro } from '#lib/domain/format';
	import { statusLabel } from '#lib/domain/status';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Tournois · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{data.season.name}</p>
		<h1>Tournois</h1>
		<p class="muted">Chaque tournoi clôturé alimente le championnat et le classement 7-2.</p>
	</div>
	<a class="btn btn-primary" href="/tournois/nouveau">Nouveau tournoi</a>
</div>

{#if data.tournaments.length === 0}
	<div class="card">
		<div class="card-body">
			<div class="empty">
				Aucun tournoi cette saison.<br />
				<a href="/tournois/nouveau">Créer le premier tournoi</a>
			</div>
		</div>
	</div>
{:else}
	<div class="stack">
		{#each data.tournaments as tournament (tournament.id)}
			<article class="tournament-row">
				<div class="stack" style="gap: 0.25rem;">
					<div class="cluster">
						<a href="/t/{tournament.id}">{tournament.name}</a>
						{#if tournament.multiplier === 2}
							<span class="badge badge-gold">Journée double</span>
						{/if}
						<span class="badge" class:badge-green={tournament.status === 'running'} class:badge-gold={tournament.status === 'finished'}>
							{statusLabel(tournament.status)}
						</span>
					</div>
					<span class="small muted">
						{formatDateFr(tournament.played_at)} · {tournament.player_count} joueur{tournament.player_count > 1 ? 's' : ''}
						· {tournament.entries_count} entrée{tournament.entries_count > 1 ? 's' : ''}
						· buy-in {formatEuro(tournament.buy_in)}
					</span>
				</div>
				<div class="cluster">
					<span class="small muted">Pool {formatEuro(tournament.buy_in * tournament.entries_count)}</span>
					{#if tournament.status === 'running'}
						<a class="btn btn-sm" href="/ecran">Écran</a>
						<a class="btn btn-sm btn-gold" href="/t/{tournament.id}/controle">Contrôle</a>
					{:else if tournament.status === 'finished'}
						<a class="btn btn-sm" href="/t/{tournament.id}/resultats">Résultats</a>
						<a class="btn btn-sm btn-gold" href="/t/{tournament.id}/synthese">Synthèse</a>
					{:else}
						<a class="btn btn-sm" href="/t/{tournament.id}">Ouvrir</a>
					{/if}
				</div>
			</article>
		{/each}
	</div>
{/if}
