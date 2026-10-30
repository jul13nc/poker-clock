<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateFr, formatEuro, formatPlayerName } from '#lib/domain/format';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Synthèse · {data.tournament.name}</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">{formatDateFr(data.tournament.played_at)} · {data.tournament.season_name}</p>
		<h1>Synthèse du jour</h1>
		<p class="muted">
			{data.tournament.name}
			{#if data.tournament.multiplier === 2} · journée double ×2{/if}
		</p>
	</div>
	<div class="cluster">
		<a class="btn" href="/t/{data.tournament.id}/resultats">Résultats détaillés</a>
		<a class="btn" href="/classements">Classements</a>
		{#if data.isAdmin && !data.finished}
			<a class="btn btn-gold" href="/t/{data.tournament.id}/cloture">Clôturer</a>
		{/if}
	</div>
</div>

{#if !data.finished}
	<p class="notice notice-info" style="margin-bottom: 1rem;">
		Tournoi en cours : l'ordre affiché est provisoire. Les gains et les points seront calculés
		à la clôture. <a href="/t/{data.tournament.id}/controle">Retour au contrôle</a>.
	</p>
{/if}

<section class="grid grid-3">
	<div class="stat">
		<div class="stat-value">{data.rows.length}</div>
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
		<div class="stat-value">{data.totals.hands72}</div>
		<div class="stat-label">Mains 7-2</div>
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<div class="card-head">
		<h2>Classement du jour</h2>
		<span class="small muted">
			{#if data.finished}
				Points du jour ×{data.tournament.multiplier} · cumul de la saison
			{:else}
				Ordre provisoire
			{/if}
		</span>
	</div>
	<div class="card-body">
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>Place</th>
						<th>Joueur</th>
						<th class="num">7-2</th>
						{#if data.finished}
							<th class="num">Gain</th>
							<th class="num">Points du jour</th>
							<th class="num">Points généraux</th>
							<th class="num">Rang général</th>
						{:else}
							<th>Statut</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.playerId)}
						<tr>
							<td>
								{#if row.finishRank}
									<span
										class="rank"
										class:rank-1={row.finishRank === 1}
										class:rank-2={row.finishRank === 2}
										class:rank-3={row.finishRank === 3}
									>
										{row.finishRank}
									</span>
								{:else}
									<span class="badge badge-green">En jeu</span>
								{/if}
							</td>
							<td><strong>{formatPlayerName(row.name, row.entries, row.rebuyOrder)}</strong></td>
							<td class="num">{row.hands72}</td>
							{#if data.finished}
								<td class="num">{row.prize ? formatEuro(row.prize) : '—'}</td>
								<td class="num">
									<strong style="color: var(--gold-soft);">{row.dayPoints ?? 0}</strong>
									{#if row.dayPointsRank}
										<span class="small muted">({row.dayPointsRank}e du jour)</span>
									{/if}
								</td>
								<td class="num">{row.totalPoints}</td>
								<td class="num">
									<span class="badge badge-gold">{row.generalRank}</span>
								</td>
							{:else}
								<td>
									{#if row.finishRank}
										<span class="badge">Éliminé</span>
									{:else}
										<span class="badge badge-green">En jeu</span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</section>

{#if data.finished && data.payouts.length > 0}
	<section class="card" style="margin-top: 1.5rem;">
		<div class="card-head">
			<h2>Répartition des gains</h2>
			<span class="small muted">Pool {data.totals.poolLabel}</span>
		</div>
		<div class="card-body">
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Place</th>
							<th class="num">Montant</th>
						</tr>
					</thead>
					<tbody>
						{#each data.payouts as line (line.place)}
							<tr>
								<td><span class="rank">{line.place}</span></td>
								<td class="num"><strong style="color: var(--gold-soft);">{formatEuro(line.amount)}</strong></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</section>
{/if}

<p class="assumption" style="margin-top: 1.5rem;">
	« Points du jour » suit le barème de la saison. Avec la règle recave : R1 dernier, R2 avant-dernier, etc.
	« Points généraux » additionne la journée au cumul de la saison, et « rang général » situe
	le joueur dans le championnat à l'issue de cette soirée.
</p>
