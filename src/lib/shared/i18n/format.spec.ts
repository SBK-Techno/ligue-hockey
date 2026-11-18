import { afterEach, describe, expect, it, vi } from 'vitest';
import { branding } from '#lib/generated/branding.ts';
import {
	centsToInput,
	currencySymbol,
	formatCount,
	formatDateHeading,
	formatDecimal,
	formatMoney,
	formatTime
} from './index.ts';

describe('formatCount', () => {
	it('uses the French singular for zero and one', () => {
		expect(formatCount(0, 'chat.votes.one', 'chat.votes.many')).toBe('0 vote');
		expect(formatCount(1, 'chat.votes.one', 'chat.votes.many')).toBe('1 vote');
	});

	it('uses the plural from two onwards', () => {
		expect(formatCount(2, 'chat.votes.one', 'chat.votes.many')).toBe('2 votes');
		expect(formatCount(14, 'games.openSlots.one', 'games.openSlots.many')).toBe(
			'14 places ouvertes'
		);
	});
});

describe('formatDateHeading', () => {
	it('met la majuscule sur un libellé de jour autonome', () => {
		const label = formatDateHeading('2026-11-12');

		expect(label.startsWith('J')).toBe(true);
		expect(label).toContain('12');
	});
});

describe('formatTime', () => {
	it('garde l’heure sur une seule ligne avec des espaces fines insécables', () => {
		expect(formatTime('20:30')).toBe('20\u202Fh\u202F30');
		expect(formatTime('09:00')).toBe('9\u202Fh');
	});
});

describe('formatDecimal', () => {
	it('formats with the Quebec decimal comma', () => {
		expect(formatDecimal(0, 2)).toBe('0,00');
		expect(formatDecimal(1.25, 2)).toBe('1,25');
		expect(formatDecimal(0.17, 1)).toBe('0,2');
	});
});

describe('centsToInput', () => {
	it('round-trips form money values without locale separators', () => {
		expect(centsToInput(50_000)).toBe('500.00');
		expect(centsToInput(25_050)).toBe('250.50');
	});
});

/**
 * Reference oracles: the pre-cache implementation, constructing a fresh
 * Intl.NumberFormat on every call. The cached helpers must stay
 * byte-for-byte identical to them for every input.
 */
function referenceMoney(cents: number, currency: string): string {
	return new Intl.NumberFormat(branding.locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(cents / 100);
}

function referenceSymbol(currency: string): string {
	const parts = new Intl.NumberFormat(branding.locale, {
		style: 'currency',
		currency
	}).formatToParts(0);
	return parts.find((part) => part.type === 'currency')?.value ?? currency;
}

const currencies = ['CAD', 'USD', 'EUR', 'JPY', 'GBP', 'CHF', 'XXX'];
const amounts = [
	0,
	1,
	-1,
	99,
	100,
	-12345,
	25050,
	123456789,
	12345678901234,
	1234.56,
	Number.NaN,
	Number.POSITIVE_INFINITY,
	Number.NEGATIVE_INFINITY
];

describe('formatMoney', () => {
	it.each(currencies)('matches fresh construction for every amount in %s', (currency) => {
		for (const cents of amounts) {
			expect(formatMoney(cents, currency)).toBe(referenceMoney(cents, currency));
		}
	});

	it('keeps the exact fr-CA currency strings', () => {
		expect(formatMoney(25050, 'CAD')).toBe('250,50\u00A0$');
		expect(formatMoney(0, 'CAD')).toBe('0,00\u00A0$');
		expect(formatMoney(-12345, 'CAD')).toBe('-123,45\u00A0$');
		expect(formatMoney(50000, 'USD')).toBe('500,00\u00A0$\u00A0US');
		expect(formatMoney(12345, 'JPY')).toBe('123,45\u00A0¥');
		expect(formatMoney(123456789012, 'EUR')).toBe('1\u00A0234\u00A0567\u00A0890,12\u00A0€');
	});
});

describe('currencySymbol', () => {
	it.each(currencies)('matches fresh construction in %s', (currency) => {
		expect(currencySymbol(currency)).toBe(referenceSymbol(currency));
	});

	it('keeps the exact symbols from formatToParts', () => {
		expect(currencySymbol('CAD')).toBe('$');
		expect(currencySymbol('USD')).toBe('$\u00A0US');
		expect(currencySymbol('EUR')).toBe('€');
		expect(currencySymbol('JPY')).toBe('¥');
		expect(currencySymbol('XXX')).toBe('¤');
	});
});

describe('malformed currency codes keep throwing on every call', () => {
	it('never caches a failed construction', () => {
		for (let i = 0; i < 3; i++) {
			expect(() => formatMoney(100, 'CADX')).toThrow(RangeError);
			expect(() => currencySymbol('CADX')).toThrow(RangeError);
		}
	});
});

/**
 * Regression: the number formatters must be constructed once per currency
 * and option shape, never once per call. These currencies are used nowhere
 * else in this file so the counts start from a cold cache. Before the fix
 * every call constructed a new Intl.NumberFormat and these counts failed.
 */
describe('number formatter construction is cached', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('formatMoney builds one formatter per currency, not per call', () => {
		const spy = vi.spyOn(Intl, 'NumberFormat');
		for (let i = 0; i < 200; i++) formatMoney(i * 137, 'AUD');
		expect(spy).toHaveBeenCalledTimes(1);
		for (let i = 0; i < 200; i++) formatMoney(-i * 91, 'NZD');
		expect(spy).toHaveBeenCalledTimes(2);
		formatMoney(0, 'AUD');
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('currencySymbol builds one formatter per currency, not per call', () => {
		const spy = vi.spyOn(Intl, 'NumberFormat');
		for (let i = 0; i < 50; i++) currencySymbol('SEK');
		expect(spy).toHaveBeenCalledTimes(1);
		currencySymbol('NOK');
		expect(spy).toHaveBeenCalledTimes(2);
		currencySymbol('SEK');
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('the money and symbol shapes never share a cache entry', () => {
		const spy = vi.spyOn(Intl, 'NumberFormat');
		formatMoney(12345, 'INR');
		currencySymbol('INR');
		expect(spy).toHaveBeenCalledTimes(2);
		formatMoney(0, 'INR');
		currencySymbol('INR');
		expect(spy).toHaveBeenCalledTimes(2);
	});
});
