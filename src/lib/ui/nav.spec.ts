import { describe, expect, it } from 'vitest';
import { SURFACES } from '#config/surfaces.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { mobileNavLabelKey, playerAssessmentHref } from './nav.ts';

describe('playerAssessmentHref', () => {
	it('opens the season sheet, not the game assessment', () => {
		expect(playerAssessmentHref('player_1')).toBe('/admin/evaluations/player_1');
	});
});

describe('libellé de la barre mobile', () => {
	it('utilise le libellé court déclaré par la surface', () => {
		const chat = SURFACES.find((surface) => surface.key === 'chat');

		expect(chat).toBeDefined();
		expect(mobileNavLabelKey(chat!)).toBe('nav.chatShort');
	});

	it('garde le libellé complet quand aucun libellé court n’est déclaré', () => {
		const games = SURFACES.find((surface) => surface.key === 'games');

		expect(mobileNavLabelKey(games!)).toBe('nav.games');
	});

	it('donne aux cinq places de la barre un libellé qui tient à 320 px', () => {
		for (const key of ['home', 'games', 'subs', 'chat', 'account'] as const) {
			const surface = SURFACES.find((entry) => entry.key === key);
			const label = t(mobileNavLabelKey(surface!));

			expect(surface).toBeDefined();
			expect(label.length).toBeLessThanOrEqual(9);
		}
	});
});
