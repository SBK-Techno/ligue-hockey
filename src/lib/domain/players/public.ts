import type { PlayerRow } from './schema.ts';
import type { PublicPlayer } from './service.ts';
import { t } from '#lib/shared/i18n/index.ts';

export function fullName(row: Pick<PlayerRow, 'firstName' | 'lastName'>): string {
	return `${row.firstName} ${row.lastName}`;
}

/**
 * Le nom d'une ligne absente : jamais l'identifiant technique. Une fiche
 * supprimée est anonymisée et garde ce libellé dans tout l'historique.
 */
export function neutralPlayerName(): string {
	return t('player.deletedName');
}

export function toPublic(row: PlayerRow): PublicPlayer {
	return {
		userId: row.userId,
		firstName: row.firstName,
		lastName: row.lastName,
		fullName: fullName(row),
		position: row.position,
		jerseyNumber: row.jerseyNumber,
		avatarId: row.avatarId,
		isSubstitute: row.isSubstitute,
		active: row.active
	};
}
