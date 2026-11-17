import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { GameAssessmentView } from '#lib/domain/ratings/service.ts';
import Page from './+page.svelte';

const layout = {
	actor: {
		kind: 'user' as const,
		active: true,
		userId: 'manager',
		name: 'Gérant',
		role: 'manager' as const
	},
	unread: 0,
	hasPlayerProfile: true,
	isSubstitute: false,
	avatarId: null,
	peekScope: 'public' as const,
	nav: {
		primary: [],
		mobile: [],
		account: null,
		roleLabelKey: 'admin.role.manager' as const,
		unreadCap: 9 as const
	}
};

const assessment: GameAssessmentView = {
	gameId: 'game-1',
	gameDate: '2026-09-20',
	startTime: '09:00',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'completed',
	canRate: true,
	ratedPlayers: 0,
	totalPlayers: 1,
	players: [
		{
			playerId: 'player-1',
			fullName: 'Jean-Sébastien Rousseau',
			position: 'forward',
			jerseyNumber: 15,
			values: {},
			rated: 0,
			total: 4,
			complete: false,
			version: 1
		}
	]
};

describe('feuille d’évaluation', () => {
	it('laisse l’introduction se replier sans élargir la page', () => {
		const { body } = render(Page, {
			props: {
				data: { ...layout, assessment },
				form: null,
				params: { id: assessment.gameId }
			}
		});
		const intro = body.match(
			/<div class="(flex[^"]*items-center justify-between[^"]*)">/
		)?.[1] ?? '';
		const paragraphs = [
			...body.matchAll(/<p class="([^"]*)">\s*(?:0 fiche|Comment le joueur)/g)
		];

		expect(intro).toContain('min-w-0');
		expect(intro).toContain('flex-wrap');
		expect(paragraphs).toHaveLength(2);
		for (const paragraph of paragraphs) {
			expect(paragraph[1]).toContain('min-w-0');
		}
	});
});
