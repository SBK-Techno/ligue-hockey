import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { EvaluationOverview, PlayedGameAssessment } from '#lib/domain/ratings/service.ts';
import { formatCount, formatDate, formatTime, t } from '#lib/shared/i18n/index.ts';
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

function overview(
	playerId: string,
	fullName: string,
	complete: boolean
): EvaluationOverview {
	return {
		playerId,
		fullName,
		position: 'forward',
		overall: complete ? 7.5 : null,
		positionCompleted: complete ? 6 : 2,
		positionTotal: 6,
		complete,
		updatedAt: complete ? 2 : 1
	};
}

const overviews = [
	overview('complete-1', 'Fiche Complète Un', true),
	overview('incomplete', 'Fiche Incomplète', false),
	overview('complete-2', 'Fiche Complète Deux', true)
];

const games: PlayedGameAssessment[] = [
	{
		gameId: 'complete-game',
		gameDate: '2026-11-08',
		startTime: '09:00',
		location: 'Aréna complété',
		status: 'completed',
		players: 12,
		rated: 12,
		complete: true
	},
	{
		gameId: 'incomplete-game',
		gameDate: '2026-11-15',
		startTime: '08:30',
		location: 'Aréna à évaluer',
		status: 'completed',
		players: 12,
		rated: 4,
		complete: false
	}
];

function renderPage() {
	return render(Page, {
		props: {
			data: { ...layout, overviews, games },
			form: null,
			params: {}
		}
	});
}

describe('index des évaluations', () => {
	it('montre les fiches à compléter avant les fiches complètes', () => {
		const { body } = renderPage();

		expect(body).toContain('Fiche Incomplète');
		expect(body).not.toContain('Fiche Complète Un');
		expect(body).not.toContain('Fiche Complète Deux');
		expect(body).toContain(t('admin.evaluationsProgress', { done: 2, total: 3 }));
		expect(body).toContain(
			formatCount(2, 'admin.showComplete.one', 'admin.showComplete.many')
		);
	});

	it('garde les matchs complets, mais place les matchs à évaluer en tête', () => {
		const { body } = renderPage();
		const incomplete = body.indexOf('Aréna à évaluer');
		const complete = body.indexOf('Aréna complété');

		expect(incomplete).toBeGreaterThan(-1);
		expect(complete).toBeGreaterThan(-1);
		expect(incomplete).toBeLessThan(complete);
		expect(body).toContain(t('admin.evaluationsGames'));
		expect(body).toContain(
			formatCount(1, 'admin.gamesToRate.one', 'admin.gamesToRate.many')
		);
		expect(body).toContain(
			`${formatTime('08:30')} · Aréna à évaluer`
		);
		expect(body).toContain(formatDate('2026-11-15', 'short'));
	});
});
