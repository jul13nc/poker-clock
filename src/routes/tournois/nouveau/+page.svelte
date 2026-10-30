<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { DEFAULT_REBUY_DURATION } from '#lib/domain/defaults';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Nouveau tournoi · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">Préparation</p>
		<h1>Nouveau tournoi</h1>
		<p class="muted">Choisissez la date, le buy-in et les joueurs. L'horloge se lance ensuite depuis le contrôle.</p>
	</div>
</div>

{#if form?.error}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{form.error}</p>
{/if}

{#if data.players.length < 2}
	<div class="notice notice-info" style="margin-bottom: 1rem;">
		Il faut au moins deux joueurs actifs. <a href="/joueurs">Ajouter des joueurs</a>.
	</div>
{/if}

<form method="POST" action="?/create" class="stack-lg">
	<section class="card">
		<div class="card-head"><h2>Informations</h2></div>
		<div class="card-body">
			<div class="form-grid">
				<label class="field">
					<span>Nom du tournoi</span>
					<input type="text" name="name" value="Tournoi du {data.today}" maxlength="80" required />
				</label>
				<label class="field">
					<span>Date</span>
					<input type="date" name="played_at" value={data.today} required />
				</label>
				<label class="field">
					<span>Buy-in (€)</span>
					<input type="number" name="buy_in" min="0" step="0.01" value={data.season.default_buyin} required />
				</label>
				<label class="field">
					<span>Tapis de départ (jetons)</span>
					<input
						type="number"
						name="starting_stack"
						min="1"
						step="1"
						value={data.season.default_stack ?? 10000}
						required
					/>
					<span class="hint">Sert au calcul du stack moyen affiché en direct.</span>
				</label>
				<label class="field">
					<span>Durée des recaves (minutes)</span>
					<input type="number" name="rebuy_duration" min="0" step="1" value={DEFAULT_REBUY_DURATION} required />
					<span class="hint">Depuis le démarrage, pauses manuelles exclues. 0 pour aucune recave.</span>
				</label>
				<label class="field">
					<span>Championnat</span>
					<select name="multiplier">
						<option value="1">Journée normale (×1)</option>
						<option value="2">Journée double (×2)</option>
					</select>
				</label>
				<label class="field">
					<span>Structure de blindes</span>
					<select name="structure_id">
						{#each data.structures as structure (structure.id)}
							<option value={structure.id}>
								{structure.name} — {structure.levelCount} niveaux · {Math.floor(structure.totalMinutes / 60)} h {structure.totalMinutes % 60} min
							</option>
						{/each}
					</select>
					<a class="hint" href="/blindes">Gérer les configurations de blindes</a>
				</label>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-head">
			<h2>Participants</h2>
			<span class="small muted">{data.players.length} joueur{data.players.length > 1 ? 's' : ''} actif{data.players.length > 1 ? 's' : ''}</span>
		</div>
		<div class="card-body">
			<div class="checkbox-grid">
				{#each data.players as player (player.id)}
					<label class="checkbox">
						<input type="checkbox" name="players" value={player.id} checked />
						<span>{player.name}</span>
					</label>
				{/each}
			</div>
		</div>
	</section>

	<div class="cluster">
		<button class="btn btn-primary" type="submit" disabled={data.players.length < 2}>
			Créer et ouvrir le contrôle
		</button>
		<a class="btn btn-ghost" href="/tournois">Annuler</a>
	</div>
</form>
