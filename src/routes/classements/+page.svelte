<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const scale = $derived(data.scale.join(' · '));
</script>

<svelte:head>
	<title>Classements · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{data.seasonName}</p>
		<h1>Classements</h1>
		<p class="muted">Deux courses en parallèle : les points du championnat et les mains 7-2.</p>
	</div>
	<a class="btn" href="/tournois">Voir les tournois</a>
</div>

<div class="notice notice-info" style="margin-bottom: 1.5rem;">
	<strong>Barème :</strong> {scale} points selon la place.
	{#if data.rebuyRule === 'after'}
		Les joueurs ayant recavé sont classés après les non-recavés : R1 dernier, R2 avant-dernier, etc.
	{/if}
	Une journée peut compter double. Les mains 7-2 sont saisies par l'organisateur et comptées séparément.
</div>

<section class="card">
	<div class="card-head">
		<h2>Championnat aux points</h2>
		<span class="small muted">Total de la saison</span>
	</div>
	<div class="card-body">
		{#if data.points.length === 0}
			<div class="empty">Aucun résultat pour le moment.</div>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>#</th>
							<th>Joueur</th>
							<th class="num">Points</th>
							<th class="num">Tournois</th>
							<th class="num">Victoires</th>
						</tr>
					</thead>
					<tbody>
						{#each data.points as player, index (player.id)}
							<tr>
								<td>
									<span class="rank" class:rank-1={index === 0} class:rank-2={index === 1} class:rank-3={index === 2}>
										{index + 1}
									</span>
								</td>
								<td><strong>{player.name}</strong></td>
								<td class="num"><strong style="color: var(--gold-soft);">{player.points}</strong></td>
								<td class="num">{player.played}</td>
								<td class="num">{player.wins}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>

<section class="card" id="sept-deux" style="margin-top: 1.5rem;">
	<div class="card-head">
		<h2>Classement 7-2</h2>
		<span class="small muted">Mains gagnées</span>
	</div>
	<div class="card-body">
		{#if data.hands.length === 0}
			<div class="empty">Aucune main 7-2 enregistrée pour le moment.</div>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>#</th>
							<th>Joueur</th>
							<th class="num">Mains 7-2</th>
							<th class="num">Tournois</th>
						</tr>
					</thead>
					<tbody>
						{#each data.hands as player, index (player.id)}
							<tr>
								<td>
									<span class="rank" class:rank-1={index === 0} class:rank-2={index === 1} class:rank-3={index === 2}>
										{index + 1}
									</span>
								</td>
								<td><strong>{player.name}</strong></td>
								<td class="num"><strong style="color: var(--gold-soft);">{player.hands}</strong></td>
								<td class="num">{player.tournaments}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</section>
