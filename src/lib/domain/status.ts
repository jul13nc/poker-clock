import type { TournamentStatus } from './types';

export function statusLabel(status: TournamentStatus): string {
	switch (status) {
		case 'draft':
			return 'Brouillon';
		case 'running':
			return 'En cours';
		case 'finished':
			return 'Terminé';
	}
}
