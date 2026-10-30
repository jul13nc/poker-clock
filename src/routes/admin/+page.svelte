<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const scaleText = $derived(data.scale.join(', '));
	const payoutText = $derived(JSON.stringify(data.payout, null, 2));
	const payoutSummary = $derived(
		Object.entries(data.payout)
			.sort(([a], [b]) => Number(a) - Number(b))
			.map(([pool, places]) => `${pool} € → ${Object.values(places).join(' / ')} €`)
			.join(' · ')
	);
</script>

<svelte:head>
	<title>Organisateur · Poker Clock</title>
</svelte:head>

<div class="page-head">
	<div>
		<p class="eyebrow">Coulisses</p>
		<h1>Mode organisateur</h1>
		<p class="muted">
			Le PIN protège la saisie des résultats, des recaves et des mains 7-2. Les classements restent publics.
		</p>
	</div>
</div>

{#if form?.error}
	<p class="notice notice-error" style="margin-bottom: 1rem;">{form.error}</p>
{:else if form?.success}
	<p class="notice notice-success" style="margin-bottom: 1rem;">{form.success}</p>
{/if}

{#if !data.isAdmin}
	<section class="card narrow">
		<div class="card-head"><h2>Connexion</h2></div>
		<div class="card-body stack">
			<form method="POST" action="?/login" use:enhance class="stack">
				<label class="field">
					<span>PIN organisateur</span>
					<input type="password" name="pin" inputmode="numeric" autocomplete="current-password" required />
				</label>
				<button class="btn btn-primary" type="submit">Entrer</button>
			</form>
			<p class="hint">
				Configurez <code>ADMIN_PIN</code> et <code>SESSION_SECRET</code> (32 caractères minimum).
				Aucun PIN par défaut n'est activé, même en local. Les sessions expirent après 7 jours.
			</p>
		</div>
	</section>
{:else}
	<div class="grid grid-2">
		<section class="card">
			<div class="card-head">
				<h2>Réglages de la saison</h2>
				<span class="badge badge-gold">{data.season.name}</span>
			</div>
			<div class="card-body">
				<form method="POST" action="?/save" use:enhance class="stack">
					<label class="field">
						<span>Nom de la saison</span>
						<input type="text" name="name" value={data.season.name} maxlength="60" required />
					</label>

					<label class="field">
						<span>Barème de points (du 1er au dernier)</span>
						<input type="text" name="points" value={scaleText} required />
						<span class="hint">Exemple : 10, 7, 5, 3, 2, 1. Les places suivantes marquent 0.</span>
					</label>

					<label class="field">
						<span>Table des gains (JSON)</span>
						<textarea name="payout" rows="12" required>{payoutText}</textarea>
						<span class="hint">
							Clé = montant total misé (buy-in × entrées), puis montant par place. Les pools
							sont figés en multiples de 10 €. Exemple : 50 € → 30 / 20.
						</span>
					</label>

					<div class="form-grid">
						<label class="field">
							<span>Buy-in par défaut</span>
							<input type="number" name="buy_in" min="0" step="0.01" value={data.season.default_buyin} required />
						</label>
						<label class="field">
							<span>Tapis de départ par défaut</span>
							<input
								type="number"
								name="default_stack"
								min="1"
								step="1"
								value={data.season.default_stack ?? 10000}
								required
							/>
							<span class="hint">Utilisé pour le stack moyen en direct.</span>
						</label>
						<label class="field">
							<span>Règle recave</span>
							<select name="rebuy_rule">
								<option value="after" selected={data.season.rebuy_rule === 'after'}>
									Classer après les non-recavés
								</option>
								<option value="normal" selected={data.season.rebuy_rule === 'normal'}>
									Classement normal
								</option>
							</select>
						</label>
					</div>

					<div class="divider"></div>
					<button class="btn btn-primary" type="submit">Enregistrer</button>
				</form>
			</div>
		</section>

		<section class="stack">
			<div class="card">
				<div class="card-head"><h2>Règles appliquées</h2></div>
				<div class="card-body stack small muted">
					<p><strong style="color: var(--text);">Points.</strong> {scaleText} points selon la place, multipliés par 2 lors d'une journée double.</p>
					<p><strong style="color: var(--text);">Recaves.</strong> {data.season.rebuy_rule === 'after' ? 'Les recavés sont classés après les non-recavés : R1 dernier, R2 avant-dernier, etc.' : 'La recave ne change pas l’ordre d’attribution des points.'}</p>
					<p><strong style="color: var(--text);">Gains.</strong> Pool = buy-in × entrées (recaves incluses), réparti selon la table : {payoutSummary}.</p>
					<p><strong style="color: var(--text);">7-2.</strong> Compteur séparé, saisi par l'organisateur, sans impact sur les points.</p>
				</div>
			</div>

			<div class="card">
				<div class="card-head"><h2>Accès rapide</h2></div>
				<div class="card-body stack">
					<a class="btn btn-primary" href="/tournois/nouveau">Créer un tournoi</a>
					<a class="btn" href="/joueurs">Gérer les joueurs</a>
					<a class="btn" href="/classements">Voir les classements</a>
					<form method="POST" action="?/logout">
						<button class="btn btn-ghost btn-wide" type="submit">Se déconnecter</button>
					</form>
				</div>
			</div>
		</section>
	</div>
{/if}
