import { describe, expect, it } from 'vitest';
import { PERIOD_NUMBERS, isPeriod } from '#config/periods.ts';

describe('bornes des périodes', () => {
	const first = PERIOD_NUMBERS[0];
	const last = PERIOD_NUMBERS[PERIOD_NUMBERS.length - 1];

	it.each([
		[first, true, 'première période'],
		[last, true, 'dernière période'],
		[first - 1, false, 'une avant la première'],
		[last + 1, false, 'une après la dernière'],
		[2.5, false, 'fraction'],
		[Number.NaN, false, 'NaN']
	])('%s (%s): %s', (value, expected) => {
		expect(isPeriod(value)).toBe(expected);
	});

	it('ne déclare aucune période hors de la séquence', () => {
		expect(PERIOD_NUMBERS).toEqual([1, 2, 3, 4]);
		expect(PERIOD_NUMBERS.every((period) => isPeriod(period))).toBe(true);
	});
});
