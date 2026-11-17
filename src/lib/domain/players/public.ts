import type { PlayerRow } from './schema.ts';
import type { PublicPlayer } from './service.ts';

export function fullName(row: Pick<PlayerRow, 'firstName' | 'lastName'>): string {
	return `${row.firstName} ${row.lastName}`;
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
