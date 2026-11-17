import { describe, expect, it } from 'vitest';
import { scrollBehavior } from './scroll.ts';

describe('scrollBehavior', () => {
	it.each([
		[false, 'smooth'],
		[true, 'auto']
	] as const)('motion reduced=%s -> %s', (reduced, expected) => {
		expect(scrollBehavior(reduced)).toBe(expected);
	});
});
