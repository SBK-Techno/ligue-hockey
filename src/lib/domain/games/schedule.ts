import { branding } from '#lib/generated/branding.ts';
import { addDays, clock, dateOnlyToDate, zonedDateTimeToMs } from '#lib/shared/time/clock.ts';

/**
 * Un seul propriétaire du partage horaire. Une date seule ne suffit pas : un
 * match de 19 h n'est plus « à venir » à 23 h le même jour. Le statut garde son
 * mot : un match annulé reste visible jusqu'à son heure, un match terminé
 * passe aux archives même si sa date est future.
 */
export type ScheduleGame = {
	id: string;
	gameDate: string;
	startTime: string;
	status: string;
};

export type ScheduleSplit<T extends ScheduleGame> = {
	upcoming: T[];
	past: T[];
};

export function gameStartsAt(
	game: Pick<ScheduleGame, 'gameDate' | 'startTime'>,
	timeZone: string = branding.timezone
): number {
	return zonedDateTimeToMs(game.gameDate, game.startTime, timeZone);
}

function isUpcoming(game: ScheduleGame, at: number, timeZone: string): boolean {
	if (game.status === 'completed') return false;
	return gameStartsAt(game, timeZone) > at;
}

export function splitSchedule<T extends ScheduleGame>(
	games: readonly T[],
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): ScheduleSplit<T> {
	const upcoming: T[] = [];
	const past: T[] = [];
	for (const game of games) {
		(isUpcoming(game, at, timeZone) ? upcoming : past).push(game);
	}
	return { upcoming, past };
}

/**
 * Le prochain match est le premier match encore programmé, jamais le premier
 * élément de la liste : un match annulé en tête ne doit pas cacher le suivant.
 */
export function nextGameId(
	games: readonly ScheduleGame[],
	at: number = clock.nowMs(),
	timeZone: string = branding.timezone
): string | null {
	for (const entry of splitSchedule(games, at, timeZone).upcoming) {
		if (entry.status === 'scheduled') return entry.id;
	}
	return null;
}

/** Le jour de ligue suivant : le prochain dimanche, jamais aujourd'hui. */
export function nextLeagueDay(today: string): string {
	const weekday = dateOnlyToDate(today).getUTCDay();
	const days = weekday === 0 ? 7 : 7 - weekday;
	return addDays(today, days);
}

export type DraftGame = ScheduleGame & { locationId: string };
export type DraftLocation = { id: string; name: string };

export type GameDraft = {
	date: string;
	time: string;
	locationId: string;
};

/**
 * Les valeurs d'un nouveau match : le match non annulé le plus proche déjà
 * joué sert de modèle, sinon le prochain match programmé, sinon les réglages.
 * Le match le plus lointain ne sert jamais de modèle.
 */
export function defaultGameDraft(input: {
	games: readonly DraftGame[];
	locations: readonly DraftLocation[];
	defaultLocationName: string;
	defaultStartTime: string;
	today: string;
	at?: number;
	timeZone?: string;
}): GameDraft {
	const at = input.at ?? clock.nowMs();
	const timeZone = input.timeZone ?? branding.timezone;
	const playable = input.games.filter((game) => game.status !== 'cancelled');
	let reference: DraftGame | null = null;
	for (const game of playable) {
		const startsAt = gameStartsAt(game, timeZone);
		if (startsAt <= at && (!reference || startsAt > gameStartsAt(reference, timeZone))) {
			reference = game;
		}
	}
	if (!reference) {
		for (const game of playable) {
			const startsAt = gameStartsAt(game, timeZone);
			if (startsAt > at && (!reference || startsAt < gameStartsAt(reference, timeZone))) {
				reference = game;
			}
		}
	}
	const configured =
		input.locations.find((location) => location.name === input.defaultLocationName) ??
		null;
	return {
		date: nextLeagueDay(input.today),
		time: reference?.startTime ?? input.defaultStartTime,
		locationId: reference?.locationId ?? configured?.id ?? input.locations[0]?.id ?? ''
	};
}
