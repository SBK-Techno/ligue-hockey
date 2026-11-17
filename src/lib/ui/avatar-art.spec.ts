import { describe, expect, it } from 'vitest';
import { IDENTITIES } from '#config/identities.ts';
import { avatarSvg } from './avatar-art.ts';

describe('rendu des avatars', () => {
	it('produit un SVG distinct pour chaque variante', () => {
		const rendered = IDENTITIES.map((avatar) => avatarSvg(avatar));
		expect(rendered).toHaveLength(43);
		expect(new Set(rendered).size).toBe(43);
		for (const svg of rendered) {
			expect(svg.startsWith('<svg')).toBe(true);
			expect(svg).toContain('viewBox="0 0 512 512"');
			expect(svg).toContain('aria-hidden="true"');
		}
	});

	it('n’écrit aucune couleur brute', () => {
		for (const avatar of IDENTITIES) {
			const svg = avatarSvg(avatar);
			expect(svg, avatar.id).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
			expect(svg, avatar.id).not.toMatch(/\b(rgb|hsl)a?\(/);
		}
	});

	it('n’utilise que les jetons et la couleur du joueur', () => {
		for (const avatar of IDENTITIES) {
			const svg = avatarSvg(avatar);
			expect(svg, avatar.id).toContain('fill="var(--player-color)"');
			const colours = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(
				(match) => match[1]
			);
			for (const colour of colours) {
				const allowed =
					colour === 'none' ||
					colour === 'var(--player-color)' ||
					colour.startsWith('var(--color-');
				expect(allowed, `${avatar.id}: ${colour}`).toBe(true);
			}
		}
	});

	it('garde le SVG sans texte et sans gabarit non résolu', () => {
		for (const avatar of IDENTITIES) {
			const svg = avatarSvg(avatar);
			expect(svg, avatar.id).not.toContain('<text');
			expect(svg, avatar.id).not.toContain('fill="h"');
			expect(svg, avatar.id).not.toContain('${');
		}
	});
});
