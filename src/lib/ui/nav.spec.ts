import { describe, expect, it } from 'vitest';
import { playerAssessmentHref } from './nav.ts';

describe('playerAssessmentHref', () => {
	it('opens the season sheet, not the game assessment', () => {
		expect(playerAssessmentHref('player_1')).toBe('/admin/evaluations/player_1');
	});
});
