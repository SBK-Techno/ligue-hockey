import { describe, expect, it } from 'vitest';
import { ruleModeDefinition, ruleModeFor } from '#config/rule-modes.ts';
import { adminUpdatePlayerSchema, updateOwnProfileSchema } from './validators.ts';

const base = {
	firstName: 'Alex',
	lastName: 'Tremblay',
	age: '32',
	position: 'forward'
};

describe('jersey number', () => {
	it('accepts the full range and both bounds', () => {
		for (const value of [1, 12, 99, '1', '99']) {
			const parsed = updateOwnProfileSchema.safeParse({ ...base, jerseyNumber: value });
			expect(parsed.success, String(value)).toBe(true);
		}
	});

	it('rejects out-of-range and non-integer numbers', () => {
		for (const value of [0, 100, -1, 1.5, 'abc']) {
			const parsed = updateOwnProfileSchema.safeParse({ ...base, jerseyNumber: value });
			expect(parsed.success, String(value)).toBe(false);
		}
	});

	it('leaves the jersey unchanged when the admin form omits it', () => {
		const parsed = adminUpdatePlayerSchema.safeParse({ firstName: 'Alex' });
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.jerseyNumber).toBeUndefined();
	});

	it('treats an empty field as no jersey', () => {
		const parsed = updateOwnProfileSchema.safeParse({ ...base, jerseyNumber: '' });
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.jerseyNumber).toBeNull();
	});
});

describe('avatar', () => {
	it('accepts a catalogue id and rejects an unknown one', () => {
		expect(
			updateOwnProfileSchema.safeParse({ ...base, jerseyNumber: 9, avatarId: 'tuque-rouge' })
				.success
		).toBe(true);
		expect(
			updateOwnProfileSchema.safeParse({ ...base, jerseyNumber: 9, avatarId: 'inconnu' })
				.success
		).toBe(false);
	});

	it('leaves the avatar unchanged when the admin form omits it', () => {
		const parsed = adminUpdatePlayerSchema.safeParse({ firstName: 'Alex' });
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.avatarId).toBeUndefined();
	});

	it('rejects an unknown avatar in the admin form', () => {
		expect(adminUpdatePlayerSchema.safeParse({ avatarId: 'inconnu' }).success).toBe(false);
	});
});

describe('rule modes', () => {
	it('round-trips every mode to a stored kind and strength', () => {
		for (const mode of ['together', 'apart', 'preferTogether', 'preferApart'] as const) {
			const definition = ruleModeDefinition(mode);
			expect(definition).toBeDefined();
			if (!definition) continue;
			expect(ruleModeFor(definition.kind, definition.strict)).toBe(mode);
		}
	});

	it('maps an unknown combination to the closest hard mode', () => {
		expect(ruleModeFor('must', true)).toBe('together');
		expect(ruleModeFor('must_not', true)).toBe('apart');
	});
});
