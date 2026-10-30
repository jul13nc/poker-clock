<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { formatPlayerName } from '#lib/domain/format';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const ordered = $derived.by(() => {
		const sorted = [...data.participants].sort(
			(a, b) => (a.finish_rank ?? 999) - (b.finish_rank ?? 999)
		);
		const taken = new Set(
			sorted
				.map((participant) => participant.finish_rank)
				.filter((rank): rank is number => rank !== null)
		);
		const free: number[] = [];
		for (let place = 1; place <= sorted.length; place++) {
			if (!taken.has(place)) free.push(place);
		}

		let cursor = 0;
		return sorted.map((participant) => ({
			...participant,
			// Les places déjà saisies via les éliminations sont conservées ; les joueurs
			// encore en jeu reçoivent les meilleures places restantes.
			suggestedRank: participant.finish_rank ?? free[cursor++] ?? 1
		}));
	});
</script>

<svelte:head>
	<title>Clôture · {data.tournament.name}</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">Fin de soirée</p>
		<h1>Clôturer le tournoi</h1>
		<p class="muted">
			Indiquez l'ordre d'arrivée réel. Les points et les gains sont calculés automatiquement.
		</p>
	</div>
	<a class="btn btn-ghost" href="/t/{data.tournament.id}/controle">Retour au contrôle</a>
</div>

{#if data.tournament.status === 'finished'}
	<p class="notice notice-info" style="margin-bottom: 1rem;">
		Ce tournoi est déjà clôturé. Valider à nouveau recalculera les points et les gains.
	</p>
{/if}

{#if form?.error}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{form.error}</p>
{/if}

<div class="notice notice-info" style="margin-bottom: 1rem;">
	<strong>Rappel des règles.</strong>
	Barème : {data.tournament.points_scale_json.replace(/[\[\]]/g, '')} points, ×{data.tournament.multiplier}.
	{#if data.tournament.rebuy_rule === 'after'}
		Les joueurs ayant recavé sont classés après les non-recavés : R1 dernier, R2 avant-dernier, etc.
	{/if}
	Gains : pool de {data.tournament.buy_in} € × entrées, réparti selon la table des gains de la saison (pools en multiples de 10 €).
</div>

<form method="POST" action="?/close" class="stack-lg">
	<section class="card">
		<div class="card-head">
			<h2>Classement final</h2>
			<span class="small muted">{ordered.length} joueurs</span>
		</div>
		<div class="card-body">
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th>Joueur</th>
							<th class="num">7-2</th>
							<th>Place</th>
						</tr>
					</thead>
					<tbody>
						{#each ordered as participant (participant.player_id)}
							<tr>
								<td><strong>{formatPlayerName(participant.name, participant.entries, participant.rebuy_order)}</strong></td>
								<td class="num">{participant.hands72}</td>
								<td>
									<select name="rank_{participant.player_id}" style="max-width: 130px;">
										{#each Array(ordered.length) as _, rankIndex}
											<option
												value={rankIndex + 1}
												selected={participant.suggestedRank === rankIndex + 1}
											>
												{rankIndex + 1}
												{rankIndex === 0 ? 'er' : 'e'}
											</option>
										{/each}
									</select>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="hint" style="margin-top: 0.8rem;">
				Les places saisies via les éliminations sont reprises telles quelles. Les joueurs encore
				en jeu se voient proposer les meilleures places restantes : le survivant est 1er.
				Vérifiez avant de valider.
			</p>
		</div>
	</section>

	<div class="cluster">
		<button class="btn btn-primary" type="submit">Valider et calculer</button>
		<a class="btn btn-ghost" href="/t/{data.tournament.id}/controle">Annuler</a>
	</div>
</form>
