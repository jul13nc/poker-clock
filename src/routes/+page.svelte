<script lang="ts">
	import type { PageData } from './$types';
	import logo from '../../Logo_VSOP.png';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Accueil · Poker Clock</title>
</svelte:head>

<section class="hero">
	<img class="hero-logo" src={logo} alt="VSOP — Vancia Series of Poker" width="796" height="796" fetchpriority="high" />
	<div class="hero-content">
		<p class="eyebrow">Championnat {data.season?.name.replace('Saison ', '')}</p>
		<h1>Le tournoi, l'horloge, et la course au titre.</h1>
		<p>
			Blindes et horloge de tournoi, gestion des joueurs, classement annuel aux points et
			classement parallèle des mains gagnées avec 7-2.
		</p>
		<div class="hero-actions">
			<a class="btn btn-primary" href="/tournois/nouveau">Lancer un tournoi</a>
			<a class="btn" href="/classements">Voir les classements</a>
			{#if !data.isAdmin}
				<a class="btn btn-ghost" href="/admin">Mode organisateur</a>
			{/if}
		</div>
	</div>
</section>
