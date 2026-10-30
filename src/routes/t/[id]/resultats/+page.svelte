<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateFr, formatEuro } from '#lib/domain/format';

	let { data }: { data: PageData } = $props();

	const sorted = $derived(
		[...data.participants].sort((a, b) => (a.finish_rank ?? 999) - (b.finish_rank ?? 999))
	);
	const totalEntries = $derived(
		data.participants.reduce((sum, participant) => sum + participant.entries, 0)
	);
	const pool = $derived(data.tournament.buy_in * totalEntries);
	const prizes = $derived(sorted.filter((participant) => (participant.prize ?? 0) > 0));
	const total72 = $derived(
		data.participants.reduce((sum, participant) => sum + participant.hands72, 0)
	);
</script>

<svelte:head>
	<title>Résultats · {data.tournament.name}</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{formatDateFr(data.tournament.played_at)} · {data.tournament.season_name}</p>
		<h1>{data.tournament.name}</h1>
		<div class="cluster" style="margin-top: 0.5rem;">
			<span class="badge badge-gold">Terminé</span>
			{#if data.tournament.multiplier === 2}<span class="badge badge-gold">Journée double</span>{/if}
			<span class="badge">Buy-in {formatEuro(data.tournament.buy_in)}</span>
		</div>
	</div>
	<div class="cluster">
		<a class="btn btn-gold" href="/t/{data.tournament.id}/synthese">Synthèse du jour</a>
		<a class="btn" href="/classements">Classements</a>
		{#if data.isAdmin}
			<a class="btn" href="/t/{data.tournament.id}/cloture">Modifier</a>
		{/if}
	</div>
</div>

{#if data.tournament.status !== 'finished'}
	<p class="notice notice-info" style="margin-bottom: 1rem;">
		Ce tournoi n'est pas encore clôturé. <a href="/t/{data.tournament.id}/controle">Retour au contrôle</a>.
	</p>
{/if}

<section class="grid grid-3">
	<div class="stat">
		<div class="stat-value">{data.participants.length}</div>
		<div class="stat-label">Joueurs</div>
	</div>
	<div class="stat">
		<div class="stat-value">{totalEntries}</div>
		<div class="stat-label">Entrées</div>
	</div>
	<div class="stat">
		<div class="stat-value">{formatEuro(pool)}</div>
		<div class="stat-label">Prize pool</div>
	</div>
	<div class="stat">
		<div class="stat-value">{total72}</div>
		<div class="stat-label">Mains 7-2</div>
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<div class="card-head">
		<h2>Classement final</h2>
		<span class="small muted">Points ×{data.tournament.multiplier}</span>
	</div>
	<div class="card-body">
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>Place</th>
						<th>Joueur</th>
						<th class="num">Recaves</th>
						<th class="num">7-2</th>
						<th class="num">Place championnat</th>
						<th class="num">Points</th>
						<th class="num">Gain</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as participant (participant.player_id)}
						<tr>
							<td>
								{#if participant.finish_rank}
									<span class="rank" class:rank-1={participant.finish_rank === 1} class:rank-2={participant.finish_rank === 2} class:rank-3={participant.finish_rank === 3}>
										{participant.finish_rank}
									</span>
								{:else}
									—
								{/if}
							</td>
							<td><strong>{participant.name}</strong></td>
							<td class="num">{Math.max(0, participant.entries - 1)}</td>
							<td class="num">{participant.hands72}</td>
							<td class="num">{participant.points_rank ?? '—'}</td>
							<td class="num"><strong style="color: var(--gold-soft);">{participant.points ?? 0}</strong></td>
							<td class="num">{formatEuro(participant.prize ?? 0)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

{#if prizes.length > 0}
	<section class="card" style="margin-top: 1.5rem;">
		<div class="card-head">
			<h2>Répartition des gains</h2>
			<span class="small muted">Pool {formatEuro(pool)}</span>
		</div>
		<div class="card-body">
			<ul class="clean-list">
				{#each prizes as participant (participant.player_id)}
					<li>
						<span class="cluster">
							<span class="rank" class:rank-1={participant.finish_rank === 1} class:rank-2={participant.finish_rank === 2} class:rank-3={participant.finish_rank === 3}>
								{participant.finish_rank}
							</span>
							<span>{participant.name}</span>
						</span>
						<strong style="color: var(--gold-soft);">{formatEuro(participant.prize ?? 0)}</strong>
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<p class="assumption" style="margin-top: 1.5rem;">
	Les points sont attribués selon le barème de la saison. Les joueurs ayant recavé sont classés
	après les non-recavés pour l'attribution des points. La colonne « place championnat » montre
	l'ordre utilisé pour le barème.
</p>
