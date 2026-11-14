import { describe, expect, it } from 'vitest';
import { buildWhatsappText, orderShareParticipants } from './share';

const tournament = {
	name: 'Tournoi test',
	played_at: '2026-10-30',
	status: 'finished'
};

describe('partage WhatsApp', () => {
	it('classe les joueurs, met la coupe au vainqueur et ajoute les mentions de recave', () => {
		const text = buildWhatsappText(tournament, [
			{ name: 'Chloé', entries: 1, rebuy_order: null, finish_rank: 3, hands72: 0 },
			{ name: 'Alice', entries: 2, rebuy_order: 2, finish_rank: 1, hands72: 2 },
			{ name: 'Bob', entries: 2, rebuy_order: 1, finish_rank: 2, hands72: 1 }
		]);

		expect(text).toBe(
			'♠️ Tournoi test\n' +
				'30 oct. 2026 · 3 joueurs\n' +
				'\n' +
				'1. 🏆 Alice (R2)\n' +
				'2. Bob (R1)\n' +
				'3. Chloé\n' +
				'\n' +
				'7/2 : Alice (2), Bob (1)\n'
		);
	});

	it('signale un classement provisoire sans attribuer la coupe', () => {
		const text = buildWhatsappText(
			{ name: 'Tournoi en cours', played_at: '2026-10-30', status: 'running' },
			[
				{ name: 'Zoé', entries: 1, rebuy_order: null, finish_rank: null, hands72: 0 },
				{ name: 'Alex', entries: 1, rebuy_order: null, finish_rank: null, hands72: 1 }
			]
		);

		expect(text).toContain('2 joueurs · classement provisoire');
		expect(text).toContain('1. Alex\n2. Zoé');
		expect(text).not.toContain('🏆');
		expect(text).toContain('7/2 : Alex (1)');
	});

	it('indique explicitement quand personne n’a fait de 7/2', () => {
		const text = buildWhatsappText(tournament, [
			{ name: 'Alice', entries: 1, rebuy_order: null, finish_rank: 1, hands72: 0 }
		]);
		expect(text).toContain('7/2 : aucun');
	});

	it('place les joueurs encore en jeu après les places définitives', () => {
		const ordered = orderShareParticipants([
			{ name: 'En jeu', entries: 1, rebuy_order: null, finish_rank: null, hands72: 0 },
			{ name: 'Deuxième', entries: 1, rebuy_order: null, finish_rank: 2, hands72: 0 },
			{ name: 'Vainqueur', entries: 1, rebuy_order: null, finish_rank: 1, hands72: 0 }
		]);
		expect(ordered.map((player) => player.name)).toEqual(['Vainqueur', 'Deuxième', 'En jeu']);
	});
});
