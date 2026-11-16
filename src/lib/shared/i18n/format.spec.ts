import { describe, expect, it } from 'vitest';
import { centsToInput, formatCount, formatDecimal } from './index.ts';

describe('formatCount', () => {
	it('uses the French singular for zero and one', () => {
		expect(formatCount(0, 'chat.votes.one', 'chat.votes.many')).toBe('0 vote');
		expect(formatCount(1, 'chat.votes.one', 'chat.votes.many')).toBe('1 vote');
	});

	it('uses the plural from two onwards', () => {
		expect(formatCount(2, 'chat.votes.one', 'chat.votes.many')).toBe('2 votes');
		expect(formatCount(14, 'games.openSlots.one', 'games.openSlots.many')).toBe(
			'14 positions à pourvoir'
		);
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
