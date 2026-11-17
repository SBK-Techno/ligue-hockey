import { describe, expect, it } from 'vitest';
import { PERFORMANCE_BUDGETS } from '#config/performance.ts';
import { buildCriticalCss, buildIdentitySprite } from './branding.ts';

describe('tranche critique de la coquille', () => {
	it('reste sous le budget et couvre la connexion', async () => {
		const css = await buildCriticalCss(process.cwd());
		expect(Buffer.byteLength(css, 'utf8')).toBeLessThanOrEqual(
			PERFORMANCE_BUDGETS.authInlineCssBytes
		);
		expect(css).toContain('.auth-shell');
		expect(css).toContain('--color-paper');
	});

	it('ne contient pas la feuille complète', async () => {
		const css = await buildCriticalCss(process.cwd());
		expect(css).not.toContain('.chat-row');
		expect(css).not.toContain('.rink-token');
	});
});

describe('planche des identités', () => {
	it('rend un symbole par identité et aucune enveloppe SVG complète', () => {
		const sprite = buildIdentitySprite();
		expect((sprite.match(/<symbol\b/g) ?? []).length).toBeGreaterThanOrEqual(58);
		expect(sprite.startsWith('<svg xmlns=')).toBe(true);
		expect(sprite).not.toContain('<use');
		expect(Buffer.byteLength(sprite, 'utf8')).toBeLessThanOrEqual(
			PERFORMANCE_BUDGETS.identitySpriteBytes
		);
	});
});
