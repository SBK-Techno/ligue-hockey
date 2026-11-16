/** Locales machine pour extraire des parties numériques, jamais pour l'affichage. */
export const PART_LOCALE = 'en-CA';
export const OFFSET_LOCALE = 'en-US';

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DATE_GLOB = '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';
export const TIME_GLOB = '[0-9][0-9]:[0-9][0-9]';

/**
 * Horloge d'une feuille de match : MM:SS, de 00:00 à 20:00. La prolongation
 * utilise la même horloge, une période de 20 minutes au maximum.
 */
export const GAME_CLOCK_PATTERN = /^([01]\d|20):[0-5]\d$/;
export const GAME_CLOCK_GLOB = '[0-9][0-9]:[0-9][0-9]';
export const GAME_CLOCK_MIN = '00:00';
export const GAME_CLOCK_MAX = '20:00';

export function isValidDate(value: string): boolean {
	return DATE_PATTERN.test(value);
}

export function isValidTime(value: string): boolean {
	return TIME_PATTERN.test(value);
}

export function isValidGameClock(value: string): boolean {
	return (
		GAME_CLOCK_PATTERN.test(value) &&
		value >= GAME_CLOCK_MIN &&
		value <= GAME_CLOCK_MAX
	);
}
