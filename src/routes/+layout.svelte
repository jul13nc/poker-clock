<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import { formatDateFr } from '#lib/domain/format';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	const links = [
		{ href: '/', label: 'Accueil' },
		{ href: '/tournois', label: 'Tournois' },
		{ href: '/classements', label: 'Classements' },
		{ href: '/joueurs', label: 'Joueurs' },
		{ href: '/admin', label: 'Admin' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}
</script>

{#if /^\/ecran\/?$/.test(page.url.pathname) || /^\/t\/[^/]+\/ecran\/?$/.test(page.url.pathname)}
	{@render children()}
{:else}
<div class="topbar">
	<div class="container topbar-inner">
		<a class="brand" href="/">
			<span class="brand-mark">♠</span>
			<span>Poker Clock</span>
		</a>
		<nav class="nav" aria-label="Navigation principale">
			{#each links as link (link.href)}
				<a href={link.href} class:active={isActive(link.href)}>{link.label}</a>
			{/each}
		</nav>
		<div class="topbar-spacer"></div>
		{#if data.isAdmin}
			<span class="badge badge-gold">Organisateur</span>
		{/if}
	</div>
</div>

<main>
	<div class="container">
		{@render children()}
	</div>
</main>

<footer class="container small muted" style="padding: 0 0 2rem;">
	{data.season.name} · {formatDateFr(data.season.starts_on)} → {formatDateFr(data.season.ends_on)}
	· Blindes, horloge, championnat et 7/2.
</footer>
{/if}
