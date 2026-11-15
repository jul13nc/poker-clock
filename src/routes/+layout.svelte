<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import type { LayoutData } from './$types';
	import { formatDateFr } from '#lib/domain/format';
	import logo from '../../Logo_VSOP.png';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	let nav = $state<HTMLElement | null>(null);

	const links = [
		{ href: '/', label: 'Accueil' },
		{ href: '/tournois', label: 'Tournois' },
		{ href: '/blindes', label: 'Blindes' },
		{ href: '/classements', label: 'Classements' },
		{ href: '/joueurs', label: 'Joueurs' },
		{ href: '/admin', label: 'Admin' }
	];

	function isActive(href: string): boolean {
		const path = page.url.pathname;
		return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
	}

	// Sur mobile la navigation défile horizontalement : on centre le lien actif.
	$effect(() => {
		const path = page.url.pathname;
		if (!nav || !path) return;
		const active = nav.querySelector<HTMLElement>('a.active');
		if (!active) return;
		const navRect = nav.getBoundingClientRect();
		const linkRect = active.getBoundingClientRect();
		const left = linkRect.left - navRect.left + nav.scrollLeft;
		nav.scrollLeft = Math.max(0, left - (nav.clientWidth - active.offsetWidth) / 2);
	});
</script>

{#if /^\/live\/?$/.test(page.url.pathname) || /^\/t\/[^/]+\/ecran\/?$/.test(page.url.pathname)}
	{@render children()}
{:else}
<div class="topbar">
	<div class="container topbar-inner">
		<a class="brand" href="/" aria-label="VSOP — Accueil">
			<img class="brand-logo" src={logo} alt="" width="48" height="48" />
			<span>VSOP</span>
		</a>
		<nav class="nav" aria-label="Navigation principale" bind:this={nav}>
			{#each links as link (link.href)}
				<a
					href={link.href}
					class:active={isActive(link.href)}
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
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
	{data.season?.name} · {formatDateFr(data.season?.starts_on ?? '')} → {formatDateFr(data.season?.ends_on ?? '')}
	· Blindes, horloge, championnat et 7/2.
</footer>
{/if}
