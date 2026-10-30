<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { parseBlindText } from '#lib/domain/blinds';
	import type { Level } from '#lib/domain/types';
	import { DEFAULT_BIG_BLINDS, DEFAULT_LEVEL_DURATION } from '#lib/domain/defaults';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let id = $state('');
	let name = $state('Nouvelle structure');
	let isDefault = $state(false);
	const initialBlinds = DEFAULT_BIG_BLINDS.join('\n');
	let blindText = $state(initialBlinds);
	let duration = $state(DEFAULT_LEVEL_DURATION);
	let editNotice = $state('');
	let saving = $state(false);
	const parsed = $derived.by(() => {
		try { return { levels: parseBlindText(blindText, duration), error: '' }; }
		catch (error) { return { levels: [] as Level[], error: error instanceof Error ? error.message : 'Niveaux invalides.' }; }
	});
	const levelCount = $derived(blindText.split(/\r?\n/).filter((line) => line.trim()).length);
	const totalMinutes = $derived(levelCount * (Number.isFinite(duration) ? duration : 0));
	function edit(structure: PageData['structures'][number], copy = false) {
		id = copy ? '' : structure.id;
		name = copy ? `${structure.name} (copie)`.slice(0, 80) : structure.name;
		isDefault = copy ? false : !!structure.is_default;
		const levels: Level[] = JSON.parse(structure.levels_json);
		blindText = levels.map((level) => level.bb).join('\n');
		duration = levels[0]?.duration ?? DEFAULT_LEVEL_DURATION;
		editNotice = levels.some((level) => level.duration !== duration || level.sb !== level.bb / 2)
			? 'Cette configuration utilisait des durées ou des petites blindes différentes. À l’enregistrement, la durée commune sera appliquée et chaque SB vaudra BB / 2.' : '';
	}
	function create() {
		id = ''; name = 'Nouvelle structure'; isDefault = false; blindText = initialBlinds; duration = DEFAULT_LEVEL_DURATION; editNotice = '';
	}
</script>

<svelte:head><title>Structures de blindes · Poker Clock</title></svelte:head>

<div class="page-head">
	<div><p class="eyebrow">Préparation</p><h1>Structures de blindes</h1><p class="muted">Une grosse blinde par ligne, une durée commune à tous les niveaux. Sans ante ni pause.</p></div>
	<a class="btn" href="/tournois/nouveau">Créer un tournoi</a>
</div>

{#if form?.error}<p class="notice notice-error" role="alert">{form.error}</p>{/if}
{#if form?.success}<p class="notice notice-success" role="status">{form.success}</p>{/if}

<section class="card" style="margin-bottom: 1rem;">
	<div class="card-head"><h2>Configurations enregistrées</h2><button class="btn btn-sm" onclick={create}>Nouvelle configuration</button></div>
	<div class="card-body stack">
		{#each data.structures as structure (structure.id)}
			<div class="tournament-row">
				<div><strong>{structure.name}</strong>{#if structure.is_default} <span class="badge badge-gold">Par défaut</span>{/if}</div>
				<div class="cluster">
					<button class="btn btn-sm" onclick={() => edit(structure)}>Modifier</button>
					<button class="btn btn-sm" onclick={() => edit(structure, true)}>Dupliquer</button>
					<form method="POST" action="?/delete" use:enhance={() => { return async ({ update, result }) => {
						await update({ reset: false });
						if (result.type === 'success' && id === structure.id) create();
					}; }} onsubmit={(event) => { if (!confirm(`Supprimer « ${structure.name} » ?`)) event.preventDefault(); }}>
						<input type="hidden" name="id" value={structure.id} />
						<button class="btn btn-sm btn-danger" disabled={data.structures.length <= 1}>Supprimer</button>
					</form>
				</div>
			</div>
		{/each}
		<p class="hint">Les tournois conservent une copie de leur structure : modifier ou supprimer une configuration ne change pas les parties existantes.</p>
	</div>
</section>

<form method="POST" action="?/save" use:enhance={() => {
	saving = true;
	return async ({ result, update }) => {
		try {
			await update({ reset: false });
			if (result.type === 'success' && result.data?.savedId) id = String(result.data.savedId);
		} finally { saving = false; }
	};
}} class="card">
	<div class="card-head"><h2>{id ? 'Modifier la configuration' : 'Nouvelle configuration'}</h2><span class="small muted" aria-live="polite">{levelCount} niveaux · {Math.floor(totalMinutes / 60)} h {totalMinutes % 60} min</span></div>
	<div class="card-body stack">
		<input type="hidden" name="id" value={id} />
		<label class="field"><span>Nom de la configuration</span><input name="name" bind:value={name} minlength="2" maxlength="80" required /></label>
		<label class="checkbox"><input type="checkbox" name="is_default" bind:checked={isDefault} /><span>Utiliser par défaut pour les nouveaux tournois</span></label>
		{#if editNotice}<p class="notice notice-info">{editNotice}</p>{/if}
		<label class="field"><span>Durée d’un niveau (minutes)</span><input name="duration" type="number" min="1" max="180" step="1" bind:value={duration} required /></label>
		<label class="field"><span>Grosses blindes (une par ligne)</span><textarea aria-label="Grosses blindes (une par ligne)" name="big_blinds" rows="14" bind:value={blindText} spellcheck="false" required></textarea><span class="hint">Exemple : 50, puis 100 sur la ligne suivante. Valeurs entières paires, strictement croissantes. Lignes vides ignorées. SB = BB / 2.</span></label>
		{#if parsed.error}<p class="notice notice-error" role="alert">{parsed.error}</p>{:else}
			<p class="hint">Aperçu SB / BB : {parsed.levels.map((level) => `${level.sb} / ${level.bb}`).join(' · ')}</p>
		{/if}
		<div class="cluster">
			<button class="btn btn-primary" type="submit" disabled={saving || !!parsed.error}>{saving ? 'Enregistrement…' : 'Enregistrer la configuration'}</button>
		</div>
	</div>
</form>
