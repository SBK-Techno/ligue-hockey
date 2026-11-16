import { branding } from '#lib/generated/branding.ts';
import { clock, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';

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

export function isGamePlayable(
	game: PlayableGame,
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): boolean {
	if (!game.generated) return false;
	if (game.status === 'cancelled') return false;
	if (game.status === 'completed') return true;
	return zonedDateTimeToMs(game.gameDate, game.startTime, timeZone) <= at;
}
