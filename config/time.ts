export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DATE_GLOB = '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]';
export const TIME_GLOB = '[0-9][0-9]:[0-9][0-9]';

export function isValidDate(value: string): boolean {
	return DATE_PATTERN.test(value);
}

export function isValidTime(value: string): boolean {
	return TIME_PATTERN.test(value);
}
