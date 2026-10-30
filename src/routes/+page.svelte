<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateFr, formatEuro, formatNumber } from '#lib/domain/format';
	import { statusLabel } from '#lib/domain/status';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Accueil · Poker Clock</title>
</svelte:head>

<section class="hero">
	<p class="eyebrow">Championnat {data.season?.name.replace('Saison ', '')}</p>
	<h1>Le tournoi, l'horloge, et la course au titre.</h1>
	<p>
		Blindes et horloge de tournoi, gestion des joueurs, classement annuel aux points et
		classement parallèle des mains gagnées avec 7-2. Une seule app, pensée pour les soirées
		entre amis.
	</p>
	<div class="hero-actions">
		<a class="btn btn-primary" href="/tournois/nouveau">Lancer un tournoi</a>
		<a class="btn" href="/classements">Voir les classements</a>
		{#if !data.isAdmin}
			<a class="btn btn-ghost" href="/admin">Mode organisateur</a>
		{/if}
	</div>
</section>

<section class="grid grid-3" style="margin-top: 1rem;">
	<div class="stat">
		<div class="stat-value">{data.stats.finished}</div>
		<div class="stat-label">Tournois joués</div>
	</div>
	<div class="stat">
		<div class="stat-value">{data.stats.players}</div>
		<div class="stat-label">Joueurs classés</div>
	</div>
	<div class="stat">
		<div class="stat-value">{formatNumber(data.stats.entries)}</div>
		<div class="stat-label">Entrées (recaves incluses)</div>
	</div>
	<div class="stat">
		<div class="stat-value">{formatEuro(data.stats.totalPool)}</div>
		<div class="stat-label">Cagnotte cumulée</div>
	</div>
	<div class="stat">
		<div class="stat-value">{data.stats.hands72}</div>
		<div class="stat-label">Mains 7-2 gagnées</div>
	</div>
</section>

<section class="grid grid-2" style="margin-top: 1.5rem;">
	<div class="card">
		<div class="card-head">
			<h2>Classement aux points</h2>
			<a class="small" href="/classements">Tout voir →</a>
		</div>
		<div class="card-body">
			{#if data.points.length === 0}
				<div class="empty">
					Pas encore de tournoi clôturé.<br />
					<a href="/tournois/nouveau">Créer le premier tournoi</a>
				</div>
			{:else}
				<ol class="clean-list">
					{#each data.points as player, index (player.id)}
						<li>
							<span class="cluster">
								<span class="rank" class:rank-1={player.rank === 1} class:rank-2={player.rank === 2} class:rank-3={player.rank === 3}>
									{player.rank}
								</span>
								<span>{player.name}</span>
							</span>
							<span class="cluster small muted">
								<span>{player.played} tournoi{player.played > 1 ? 's' : ''}</span>
								<strong style="color: var(--gold-soft);">{player.points} pts</strong>
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</div>

	<div class="card">
		<div class="card-head">
			<h2>Classement 7-2</h2>
			<a class="small" href="/classements#sept-deux">Tout voir →</a>
		</div>
		<div class="card-body">
			{#if data.hands.length === 0}
				<div class="empty">Aucune main 7-2 enregistrée pour le moment.</div>
			{:else}
				<ol class="clean-list">
					{#each data.hands as player, index (player.id)}
						<li>
							<span class="cluster">
								<span class="rank" class:rank-1={index === 0} class:rank-2={index === 1} class:rank-3={index === 2}>
									{index + 1}
								</span>
								<span>{player.name}</span>
							</span>
							<strong style="color: var(--gold-soft);">{player.hands} main{player.hands > 1 ? 's' : ''}</strong>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</div>
</section>

<section class="card" style="margin-top: 1.5rem;">
	<div class="card-head">
		<h2>Derniers tournois</h2>
		<a class="small" href="/tournois">Tous les tournois →</a>
	</div>
	<div class="card-body">
		{#if data.tournaments.length === 0}
			<div class="empty">
				La saison est prête. <a href="/tournois/nouveau">Créez le premier tournoi</a>.
			</div>
		{:else}
			<div class="tournament-list">
				{#each data.tournaments as tournament (tournament.id)}
					<div class="tournament-row">
						<div class="stack" style="gap: 0.2rem;">
							<a href="/t/{tournament.id}">{tournament.name}</a>
							<span class="small muted">
								{formatDateFr(tournament.played_at)} · {tournament.player_count} joueur{tournament.player_count > 1 ? 's' : ''}
								{tournament.multiplier === 2 ? ' · journée double' : ''}
							</span>
						</div>
						<div class="cluster">
							<span class="badge" class:badge-green={tournament.status === 'running'} class:badge-gold={tournament.status === 'finished'}>
								{statusLabel(tournament.status)}
							</span>
							{#if tournament.status === 'running'}
								<a class="btn btn-sm btn-gold" href="/ecran">Écran</a>
							{:else if tournament.status === 'finished'}
								<a class="btn btn-sm" href="/t/{tournament.id}/resultats">Résultats</a>
							{:else}
								<a class="btn btn-sm" href="/t/{tournament.id}">Ouvrir</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>
