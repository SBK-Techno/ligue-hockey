import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import FormFeedback from './FormFeedback.svelte';
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

	it('shows an unsectioned result at page level and keeps a sectioned result at home', () => {
		const global: FormResult = { ok: false, message: 'Erreur' };
		expect(feedbackFor(global)).toBe(global);
		expect(feedbackFor({ ok: true, message: 'Enregistré', section: 'compte' })).toBeNull();
	});

	it('ignores an empty result', () => {
		expect(feedbackFor(null, 'compte')).toBeNull();
	});
});

describe('rendu de la rétroaction', () => {
	it('peut recevoir le focus quand un nouveau résultat arrive', () => {
		const { body } = render(FormFeedback, {
			props: {
				form: { ok: false, message: 'Erreur', section: 'lineup' },
				section: 'lineup',
				focusOnChange: true
			}
		});

		expect(body).toContain('tabindex="-1"');
		expect(body).toContain('role="alert"');
	});

	it('reste une simple ligne sans déplacement de focus', () => {
		const { body } = render(FormFeedback, {
			props: { form: { ok: true, message: 'Enregistré' } }
		});

		expect(body).not.toContain('tabindex');
		expect(body).toContain('role="status"');
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
