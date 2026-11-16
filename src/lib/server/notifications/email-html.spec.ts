import { describe, expect, it } from 'vitest';
import { renderEmailHtml, renderEmailText } from './email-html.ts';

const base = {
	heading: 'Votre accès',
	greeting: 'Bonjour <script>alert(1)</script>,',
	paragraphs: ['Un compte est prêt.'],
	actionLabel: 'Choisir mon mot de passe',
	actionUrl: 'https://hockey.example/reinitialiser-mot-de-passe?token=abc',
	note: 'Ce lien est valable 7 jours.'
};

describe('transactional email html', () => {
	it('escapes interpolated values', () => {
		const html = renderEmailHtml(base, 'Votre accès', 'https://hockey.example');
		expect(html).not.toContain('<script>alert(1)</script>');
		expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
	});

	it('uses the action url for the primary button', () => {
		const html = renderEmailHtml(base, 'Votre accès', 'https://hockey.example');
		expect(html).toContain('href="https://hockey.example/reinitialiser-mot-de-passe?token=abc"');
		expect(html).toContain('Choisir mon mot de passe');
	});

	it('rejects non-http action urls', () => {
		const html = renderEmailHtml(
			{ ...base, actionUrl: 'javascript:alert(1)' },
			'Votre accès',
			'https://hockey.example'
		);
		expect(html).not.toContain('javascript:alert(1)');
		expect(html).toContain('href="https://hockey.example/"');
	});

	it('keeps the plain-text part aligned with the branded email', () => {
		const text = renderEmailText(base, 'https://hockey.example');
		expect(text).toContain('Bonjour <script>alert(1)</script>,');
		expect(text).toContain('Choisir mon mot de passe: https://hockey.example/');
		expect(text).toContain('Ce lien est valable 7 jours.');
		expect(text).toContain('Ligue de hockey du dimanche matin');
		expect(text).toContain('https://hockey.example');
	});
});
