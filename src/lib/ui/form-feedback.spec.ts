import { describe, expect, it } from 'vitest';
import { feedbackFor, fieldErrorFor, type FormResult } from './form-feedback.ts';

const sections = ['compte', 'joueur', 'positions', 'notifications', 'securite'] as const;

describe('feedbackFor', () => {
	it.each(sections)('shows a %s message only in its section', (section) => {
		const form: FormResult = { ok: true, message: 'Enregistré', section };
		for (const candidate of sections) {
			const result = feedbackFor(form, candidate);
			if (candidate === section) expect(result).toBe(form);
			else expect(result).toBeNull();
		}
	});

	it('keeps the legacy page-level behaviour without a section', () => {
		const form: FormResult = { ok: false, message: 'Erreur' };
		expect(feedbackFor(form)).toBe(form);
	});

	it('ignores an empty result', () => {
		expect(feedbackFor(null, 'compte')).toBeNull();
	});
});

describe('fieldErrorFor', () => {
	const form: FormResult = {
		ok: false,
		message: 'Le mot de passe actuel est incorrect.',
		section: 'securite',
		field: 'currentPassword'
	};

	it('ties a wrong current password to its field', () => {
		expect(fieldErrorFor(form, 'securite', 'currentPassword')).toBe(
			'Le mot de passe actuel est incorrect.'
		);
	});

	it.each([
		['another section', 'compte', 'currentPassword'],
		['another field', 'securite', 'newPassword']
	])('stays silent for %s', (_label, section, field) => {
		expect(fieldErrorFor(form, section, field)).toBeNull();
	});

	it('does not mark a field after a success', () => {
		expect(
			fieldErrorFor({ ...form, ok: true }, 'securite', 'currentPassword')
		).toBeNull();
	});
});
