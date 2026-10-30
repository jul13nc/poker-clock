<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import { formatDateFr, formatEuro, formatPlayerName } from '#lib/domain/format';
	import { statusLabel } from '#lib/domain/status';

	let { data }: { data: PageData } = $props();

	const sorted = $derived(
		[...data.participants].sort((a, b) => {
			if (a.finish_rank === null) return 1;
			if (b.finish_rank === null) return -1;
			return a.finish_rank - b.finish_rank;
		})
	);
</script>

<svelte:head>
	<title>{data.tournament.name} · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{formatDateFr(data.tournament.played_at)}</p>
		<h1>{data.tournament.name}</h1>
		<div class="cluster" style="margin-top: 0.5rem;">
			<span class="badge" class:badge-green={data.tournament.status === 'running'} class:badge-gold={data.tournament.status === 'finished'}>
				{statusLabel(data.tournament.status)}
			</span>
			{#if data.tournament.multiplier === 2}<span class="badge badge-gold">Journée double</span>{/if}
			<span class="badge">Buy-in {formatEuro(data.tournament.buy_in)}</span>
		</div>
	</div>
	<div class="cluster">
		{#if data.tournament.status === 'running'}
			<a class="btn btn-gold" href="/t/{data.tournament.id}/ecran">Écran TV</a>
			<a class="btn btn-primary" href="/t/{data.tournament.id}/controle">Contrôle</a>
		{:else if data.tournament.status === 'finished'}
			<a class="btn" href="/t/{data.tournament.id}/resultats">Résultats</a>
			<a class="btn btn-gold" href="/t/{data.tournament.id}/synthese">Synthèse du jour</a>
		{:else}
			<a class="btn btn-primary" href="/t/{data.tournament.id}/controle">Ouvrir le contrôle</a>
		{/if}
	</div>
</div>

<section class="grid grid-3">
	<div class="stat">
		<div class="stat-value">{data.totals.players}</div>
		<div class="stat-label">Joueurs</div>
	</div>
	<div class="stat">
		<div class="stat-value">{data.totals.entries}</div>
		<div class="stat-label">Entrées (recaves incluses)</div>
	</div>
	<div class="stat">
		<div class="stat-value">{data.totals.poolLabel}</div>
		<div class="stat-label">Prize pool</div>
	</div>
	<div class="stat">
		<div class="stat-value">×{data.tournament.multiplier}</div>
		<div class="stat-label">Coefficient championnat</div>
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<div class="card-head">
		<h2>{data.tournament.status === 'finished' ? 'Classement final' : 'Participants'}</h2>
		<span class="small muted">{data.participants.length} inscrit{data.participants.length > 1 ? 's' : ''}</span>
	</div>
	<div class="card-body">
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>#{data.tournament.status === 'finished' ? '' : '·'}</th>
						<th>Joueur</th>
						<th class="num">7-2</th>
						{#if data.tournament.status === 'finished'}
							<th class="num">Points</th>
							<th class="num">Gain</th>
						{/if}
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
									<span class="muted">—</span>
								{/if}
							</td>
							<td><strong>{formatPlayerName(participant.name, participant.entries, participant.rebuy_order)}</strong></td>
							<td class="num">{participant.hands72}</td>
							{#if data.tournament.status === 'finished'}
								<td class="num">{participant.points ?? 0}</td>
								<td class="num">{formatEuro(participant.prize ?? 0)}</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.isAdmin}
			<div class="divider"></div>
			<form method="POST" action="?/delete" use:enhance onsubmit={(event) => { if (!confirm('Supprimer définitivement ce tournoi et tous ses résultats ?')) event.preventDefault(); }}>
				<button class="btn btn-danger btn-sm" type="submit">Supprimer le tournoi</button>
			</form>
		{/if}
	</div>
</section>
