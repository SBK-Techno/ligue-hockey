import { branding } from '#lib/generated/branding.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { gameStartsAt } from './schedule.ts';

/**
 * Un match se note une fois qu'il a été joué. La date et l'heure de départ
 * décident ensemble : un match de 9 h n'est pas jouable à 8 h le même jour.
 * Un match annulé ne se note jamais, même s'il est déjà passé.
 */
export type PlayableGame = {
	status: string;
	gameDate: string;
	startTime: string;
	generated: boolean;
};

export function isGameStarted(
	game: Pick<PlayableGame, 'gameDate' | 'startTime'>,
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): boolean {
	return gameStartsAt(game, timeZone) <= at;
}

export function isGamePlayable(
	game: PlayableGame,
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): boolean {
	if (!game.generated) return false;
	if (game.status === 'cancelled') return false;
	if (game.status === 'completed') return true;
	return gameStartsAt(game, timeZone) <= at;
}

/**
 * L'alignement se modifie seulement avant le début d'un match encore
 * programmé. Un match commencé, terminé ou annulé est figé; aucune comparaison
 * de chaîne de date ne décide de cette politique. La génération n'entre pas
 * dans cette décision : seule l'heure de départ et le statut la fixent.
 */
export function isLineupEditable(
	game: Pick<PlayableGame, 'status' | 'gameDate' | 'startTime'>,
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): boolean {
	return game.status === 'scheduled' && gameStartsAt(game, timeZone) > at;
}
