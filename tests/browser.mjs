import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'poker-clock-browser-'));
const cli = join(root, 'node_modules/.bin/wrangler');
const base = 'http://localhost:8799';
const pin = 'test-987654';
const run = (args) => execFileSync(cli, args, { cwd: root, stdio: 'pipe' });
const sql = (command) => run(['d1', 'execute', 'poker-clock-db', '--local', '--persist-to', directory, '--command', command]);
run(['d1', 'migrations', 'apply', 'poker-clock-db', '--local', '--persist-to', directory]);
const server = spawn(cli, ['dev', '--port', '8799', '--persist-to', directory,
	'--var', `ADMIN_PIN:${pin}`, '--var', 'SESSION_SECRET:browser-test-secret-with-at-least-32-characters'],
	{ cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '';
server.stdout.on('data', (data) => { logs += data; });
server.stderr.on('data', (data) => { logs += data; });
let browser;
try {
	let ready = false;
	for (let i = 0; i < 100; i++) {
		try { if ((await fetch(`${base}/api/tournaments/current/state`)).ok) { ready = true; break; } } catch {}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	assert.ok(ready, 'Worker local indisponible');
	browser = await chromium.launch();
	const tv = await browser.newPage({ viewport: { width: 960, height: 540 } });
	const errors = [];
	tv.on('pageerror', (error) => errors.push(error.message));
	await tv.addInitScript(() => { const original = Date.now; Date.now = () => original() + 300_000; });
	await tv.goto(`${base}/ecran`);
	await tv.getByText("En attente d'un tournoi").waitFor();
	const players = Array.from({ length: 12 }, (_, i) => `INSERT INTO players(id,name) VALUES ('p${i}','Joueur ${i + 1}'); INSERT INTO tournament_players(tournament_id,player_id,seat) VALUES ('t','p${i}',${i + 1});`).join('');
	sql(`INSERT INTO seasons(id,name,starts_on,ends_on) VALUES ('s','Saison test','2020-09-01','2021-06-30'); INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 't','s','Partie 1','2026-10-30',levels_json FROM blind_structures LIMIT 1; ${players}`);
	await tv.getByText('Placement à table', { exact: true }).waitFor({ timeout: 15000 });
	async function fits(label) {
		const result = await tv.evaluate(() => ({
			width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
			outside: [...document.querySelectorAll('.screen-center,.screen-side,.screen-foot,.screen-controls,.seat-board')]
				.map((el) => el.getBoundingClientRect()).some((r) => r.x < -1 || r.y < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1)
		}));
		assert.ok(result.scrollWidth <= result.width && result.scrollHeight <= result.height && !result.outside, `${label}: ${JSON.stringify(result)}`);
		console.log(`${label}: ${result.width} × ${result.height} OK`);
	}
	await fits('Places');
	const admin = await browser.newPage();
	admin.on('pageerror', (error) => errors.push(error.message));
	await admin.goto(`${base}/admin`);
	await admin.locator('input[name=pin]').fill(pin);
	await admin.getByRole('button', { name: 'Entrer', exact: true }).click();
	await admin.getByRole('heading', { name: 'Réglages de la saison' }).waitFor();
	await admin.goto(`${base}/t/t/controle`);
	await admin.getByRole('button', { name: 'Démarrer', exact: true }).click();
	await tv.getByText('Niveau 1', { exact: true }).waitFor({ timeout: 15000 });
	const time = await tv.locator('.screen-time').innerText();
	assert.match(time, /^(14|15):/, 'La TV doit ignorer décalage de 5 minutes de son horloge');
	for (const viewport of [{ width: 960, height: 540 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
		await tv.setViewportSize(viewport); await fits('Horloge');
	}
	await tv.setViewportSize({ width: 960, height: 540 });
	await admin.getByRole('button', { name: 'Pause', exact: true }).click();
	await tv.getByText('Niveau 1 · en pause', { exact: true }).waitFor({ timeout: 15000 });
	await fits('Pause');
	const actionUrl = `${base}/api/tournaments/t/action`;
	const stateUrl = `${base}/api/tournaments/t/state`;
	let current = (await (await admin.request.get(stateUrl)).json()).state;
	const duplicate = { action: 'rebuy', playerId: 'p0', commandId: crypto.randomUUID(), expectedRevision: current.revision };
	const duplicates = await Promise.all([admin.request.post(actionUrl, { data: duplicate }), admin.request.post(actionUrl, { data: duplicate })]);
	assert.deepEqual(duplicates.map((r) => r.status()), [200, 200]);
	current = (await (await admin.request.get(stateUrl)).json()).state;
	assert.equal(current.players.find((p) => p.id === 'p0').entries, 2);
	const competing = await Promise.all(['p1', 'p2'].map((playerId) => admin.request.post(actionUrl, { data: {
		action: 'eliminate', playerId, commandId: crypto.randomUUID(), expectedRevision: current.revision
	} })));
	assert.deepEqual(competing.map((r) => r.status()).sort(), [200, 409]);
	current = (await (await admin.request.get(stateUrl)).json()).state;
	assert.equal(current.players.filter((p) => p.finishRank !== null).length, 1);
	console.log('D1 concurrent : replay idempotent et conflit de révision OK.');
	const timings = [];
	for (let i = 0; i < 3; i++) {
		current = (await (await admin.request.get(stateUrl)).json()).state;
		const start = performance.now();
		const result = await admin.request.post(actionUrl, { data: { action: 'set_rebuy_duration', minutes: 91 + i, commandId: crypto.randomUUID(), expectedRevision: current.revision } });
		assert.equal(result.status(), 200);
		const commandMs = performance.now() - start;
		const seconds = Math.ceil(((91 + i) * 60_000 - (current.clock.pausedAt - current.clock.startedAt - current.clock.pausedTotalMs)) / 1000);
		const expected = `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
		await tv.waitForFunction((text) => document.querySelector('.screen-rebuy')?.textContent?.includes(text), expected, { timeout: 15000 });
		timings.push({ commandMs: Math.round(commandMs), visibleMs: Math.round(performance.now() - start) });
	}
	console.log('Mesures locales contrôle → TV (3 échantillons, polling 4 s) :', JSON.stringify(timings));
	const response = await fetch(`${base}/api/tournaments/current/state`);
	const cached = await fetch(`${base}/api/tournaments/current/state`, { headers: { 'if-none-match': response.headers.get('etag') } });
	assert.equal(cached.status, 304);
	assert.equal(await cached.text(), '');
	console.log(`Payload état : ${(await response.text()).length} caractères ; état inchangé : 0 octet de corps (304).`);
	const unauthorized = await fetch(`${base}/api/tournaments/t/action`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
	assert.equal(unauthorized.status, 401);
	const invalid = await admin.request.post(`${base}/api/tournaments/t/action`, { data: null });
	assert.equal(invalid.status(), 400);
	sql("INSERT INTO tournaments(id,season_id,name,played_at,structure_json) SELECT 'u','s','Partie 2','2026-10-31',levels_json FROM blind_structures LIMIT 1;");
	await admin.goto(`${base}/t/t/cloture`);
	await admin.getByRole('button', { name: 'Valider et calculer' }).click();
	await admin.waitForURL('**/resultats');
	await tv.waitForFunction(() => document.title.includes('Partie 2'), { timeout: 15000 });
	await tv.getByText('Prêt à jouer', { exact: true }).waitFor();
	sql("UPDATE tournaments SET status='finished',revision=revision+1 WHERE id='u'");
	await tv.getByText("En attente d'un tournoi").waitFor({ timeout: 15000 });
	await fits('Attente');
	await tv.goto(`${base}/t/t/ecran`);
	await tv.getByText('Tournoi terminé', { exact: true }).waitFor();
	await fits('Ancienne URL');
	sql(`UPDATE players SET name='Alexandre Dupont-de-la-Rivière' WHERE id='p0';
	UPDATE tournaments SET structure_json='[{"sb":500000,"bb":1000000,"ante":1000000,"duration":120}]',revision=revision+1 WHERE id='t';`);
	await tv.getByText('Ante 1 000 000', { exact: true }).waitFor({ timeout: 15000 });
	await fits('Noms longs, recave, heure longue et grosses blindes');
	await admin.goto(`${base}/blindes`);
	await admin.getByLabel('Grosses blindes (une par ligne)', { exact: true }).fill('50\n100\n200\n400\n800\n1600');
	await admin.getByLabel('Durée d’un niveau (minutes)', { exact: true }).fill('20');
	await admin.getByText('6 niveaux · 2 h 0 min', { exact: true }).waitFor();
	await admin.getByLabel('Nom de la configuration', { exact: true }).fill('Structure navigateur');
	await admin.getByLabel('Utiliser par défaut pour les nouveaux tournois').check();
	await admin.getByRole('button', { name: 'Enregistrer la configuration', exact: true }).click();
	await admin.getByText('Configuration enregistrée.', { exact: true }).waitFor();
	await admin.reload();
	const savedRow = admin.locator('.tournament-row').filter({ hasText: 'Structure navigateur' });
	await savedRow.getByRole('button', { name: 'Modifier', exact: true }).click();
	assert.equal(await admin.getByLabel('Grosses blindes (une par ligne)', { exact: true }).inputValue(), '50\n100\n200\n400\n800\n1600');
	await admin.getByLabel('Durée d’un niveau (minutes)', { exact: true }).fill('15');
	await admin.getByText('6 niveaux · 1 h 30 min', { exact: true }).waitFor();
	await admin.getByRole('button', { name: 'Enregistrer la configuration', exact: true }).click();
	await admin.getByText('Configuration enregistrée.', { exact: true }).waitFor();
	await admin.goto(`${base}/tournois/nouveau`);
	const selected = await admin.locator('select[name=structure_id] option:checked').innerText();
	assert.match(selected, /Structure navigateur/);
	await admin.getByRole('button', { name: 'Créer et ouvrir le contrôle', exact: true }).click();
	await admin.waitForURL('**/controle');
	const createdId = new URL(admin.url()).pathname.split('/')[2];
	const created = (await (await admin.request.get(`${base}/api/tournaments/${createdId}/state`)).json()).state;
	assert.equal(created.levels.length, 6);
	assert.equal(created.levels[0].duration, 15);
	assert.ok(created.levels.every((level) => level.duration === 15 && level.sb === level.bb / 2));
	assert.ok(created.levels.every((level) => !level.break && level.ante === 0));
	await admin.goto(`${base}/blindes`);
	admin.once('dialog', (dialog) => dialog.accept());
	await admin.locator('.tournament-row').filter({ hasText: 'Structure navigateur' }).getByRole('button', { name: 'Supprimer', exact: true }).click();
	await admin.getByText('Configuration supprimée.', { exact: true }).waitFor();
	const unchanged = (await (await admin.request.get(`${base}/api/tournaments/${createdId}/state`)).json()).state;
	assert.deepEqual(unchanged.levels, created.levels);
	console.log('Blindes : génération, création, modification, défaut, sélection tournoi et suppression sans effet sur tournoi OK.');
	await admin.goto(`${base}/admin`);
	await admin.getByRole('button', { name: /Déconnexion|Se déconnecter/ }).click();
	await admin.goto(`${base}/t/t/controle`);
	await admin.waitForURL('**/admin');
	assert.deepEqual(errors, [], 'Erreurs navigateur');
	console.log('Sessions, API, ETag, heure serveur, transitions et affichage OK.');
} catch (error) {
	console.error(logs);
	throw error;
} finally {
	await browser?.close();
	server.kill('SIGTERM');
	await new Promise((resolve) => server.once('exit', resolve));
	rmSync(directory, { recursive: true, force: true });
}
