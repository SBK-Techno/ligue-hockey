import { describe, expect, it } from 'vitest';
import { bumpVersion, compareVersions, formatVersion, nextVersion, parseVersion } from './version.ts';

describe('version', () => {
	it.each([
		['1.2.3', { major: 1, minor: 2, patch: 3 }],
		['0.0.1', { major: 0, minor: 0, patch: 1 }],
		['10.20.30', { major: 10, minor: 20, patch: 30 }]
	])('parse %s', (value, expected) => {
		expect(parseVersion(value)).toEqual(expected);
	});

	it.each(['1.2', '1.2.3.4', '01.2.3', '1.02.3', '1.2.3-rc.1', 'v1.2.3', ''])(
		'rejects %s',
		(value) => {
			expect(() => parseVersion(value)).toThrow();
		}
	);

	it('formats a version', () => {
		expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
	});

	it('compares versions by segment', () => {
		expect(compareVersions(parseVersion('1.2.3'), parseVersion('1.2.3'))).toBe(0);
		expect(compareVersions(parseVersion('1.2.4'), parseVersion('1.2.3'))).toBeGreaterThan(0);
		expect(compareVersions(parseVersion('1.3.0'), parseVersion('1.2.9'))).toBeGreaterThan(0);
		expect(compareVersions(parseVersion('2.0.0'), parseVersion('1.99.99'))).toBeGreaterThan(0);
		expect(compareVersions(parseVersion('1.2.2'), parseVersion('1.2.3'))).toBeLessThan(0);
	});

	it.each([
		['major', '1.2.3', '2.0.0'],
		['minor', '1.2.3', '1.3.0'],
		['patch', '1.2.3', '1.2.4']
	] as const)('bumps %s', (bump, current, expected) => {
		expect(nextVersion(current, bump)).toBe(expected);
	});

	it('does not mutate the input when bumping', () => {
		const current = parseVersion('1.2.3');
		expect(bumpVersion(current, 'minor')).toEqual({ major: 1, minor: 3, patch: 0 });
		expect(current).toEqual({ major: 1, minor: 2, patch: 3 });
	});
});
