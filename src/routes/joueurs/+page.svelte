<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Joueurs · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">Le club</p>
		<h1>Joueurs</h1>
		<p class="muted">Les joueurs sont permanents : ils cumulent leurs résultats sur toute la saison.</p>
	</div>
	{#if data.isAdmin}
		<form method="POST" action="?/add" use:enhance class="cluster" style="align-items: flex-end;">
			<label class="field">
				<span>Nouveau joueur</span>
				<input type="text" name="name" placeholder="Prénom / pseudo" maxlength="40" required />
			</label>
			<button class="btn btn-primary" type="submit">Ajouter</button>
		</form>
	{/if}
</div>

{#if form?.error}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{form.error}</p>
{:else if form?.success}
	<p class="notice notice-success" style="margin-bottom: 1rem;">{form.success}</p>
{/if}

{#if !data.isAdmin}
	<p class="notice notice-info" style="margin-bottom: 1rem;">
		La liste est publique. <a href="/admin">Connectez-vous en organisateur</a> pour ajouter ou désactiver des joueurs.
	</p>
{/if}

<div class="card">
	<div class="card-head">
		<h2>{data.players.length} joueur{data.players.length > 1 ? 's' : ''}</h2>
		<span class="small muted">Saison en cours</span>
	</div>
	<div class="card-body">
		{#if data.players.length === 0}
			<div class="empty">
				Aucun joueur pour l'instant.
				{#if data.isAdmin}Ajoutez le premier avec le formulaire ci-dessus.{/if}
			</div>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Joueur</th>
							<th class="num">Points</th>
							<th class="num">Tournois</th>
							<th class="num">7-2</th>
							<th>Statut</th>
							{#if data.isAdmin}<th></th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each data.players as player (player.id)}
							<tr style:opacity={player.active ? 1 : 0.5}>
								<td><strong>{player.name}</strong></td>
								<td class="num">{player.points}</td>
								<td class="num">{player.played}</td>
								<td class="num">{player.hands72}</td>
								<td>
									<span class="badge" class:badge-green={player.active} class:badge-muted={!player.active}>
										{player.active ? 'Actif' : 'Inactif'}
									</span>
								</td>
								{#if data.isAdmin}
									<td style="text-align: right;">
										<form method="POST" action="?/toggle" use:enhance>
											<input type="hidden" name="id" value={player.id} />
											<button class="btn btn-sm" type="submit">
												{player.active ? 'Désactiver' : 'Réactiver'}
											</button>
										</form>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
