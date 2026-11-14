import { formatDateFr, formatPlayerName } from './format';

export type ShareParticipant = {
	name: string;
	entries: number;
	rebuy_order: number | null;
	finish_rank: number | null;
	hands72: number;
};

export type ShareTournament = {
	name: string;
	played_at: string;
	status: string;
};

/**
 * Ordre de partage : places définitives d'abord (du vainqueur au dernier),
 * puis les joueurs encore en jeu par ordre alphabétique.
 */
export function orderShareParticipants<T extends ShareParticipant>(participants: T[]): T[] {
	return [...participants].sort((a, b) => {
		if (a.finish_rank === null && b.finish_rank === null) {
			return a.name.localeCompare(b.name, 'fr');
		}
		if (a.finish_rank === null) return 1;
		if (b.finish_rank === null) return -1;
		return a.finish_rank - b.finish_rank;
	});
}

/** Texte prêt à coller dans le groupe WhatsApp du tournoi. */
export function buildWhatsappText(
	tournament: ShareTournament,
	participants: ShareParticipant[]
): string {
	const ordered = orderShareParticipants(participants);
	const lines: string[] = [];
	const playerCount = participants.length;
	const provisional = tournament.status !== 'finished';

	lines.push(`♠️ ${tournament.name}`);
	lines.push(
		`${formatDateFr(tournament.played_at)} · ${playerCount} joueur${playerCount > 1 ? 's' : ''}` +
			(provisional ? ' · classement provisoire' : '')
	);
	lines.push('');

	ordered.forEach((participant, index) => {
		const trophy = participant.finish_rank === 1 ? '🏆 ' : '';
		const name = formatPlayerName(participant.name, participant.entries, participant.rebuy_order);
		lines.push(`${index + 1}. ${trophy}${name}`);
	});

	lines.push('');
	const hands = ordered
		.filter((participant) => participant.hands72 > 0)
		.map((participant) => `${participant.name} (${participant.hands72})`);
	lines.push(`7/2 : ${hands.length > 0 ? hands.join(', ') : 'aucun'}`);

	return `${lines.join('\n')}\n`;
}
