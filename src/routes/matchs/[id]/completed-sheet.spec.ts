import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GameView } from '#lib/domain/games/service.ts';
import type { GameSheetView } from '#lib/domain/gamesheet/types.ts';
import MatchPage from './+page.svelte';

const game: GameView = {
	id: 'game-1',
	gameDate: '2026-11-15',
	startTime: '08:30',
	locationId: 'loc-1',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'completed',
	notes: null,
	locationAddress: null,
	locationMapUrl: null,
	slots: [],
	generation: null,
	completedAt: 1,
	lineupManualAt: null,
	openSlots: 0,
	openSlotsLabel: '',
	lineupComplete: true,
	generated: false,
	updatedAt: 1
};

const sheet: GameSheetView = {
	gameId: game.id,
	goals: [],
	penalties: [],
	score: { white: 2, black: 1 },
	totals: [],
	finalized: true
};

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

function completedBody(): string {
	return render(MatchPage, {
		props: {
			data: {
				...layout,
				game,
				availability: {
					rows: [],
					pending: [],
					present: 0,
					absent: 0,
					unknown: 0,
					summary: '',
					own: null,
					locked: false,
					canRespond: false,
					canWithdraw: false,
					substitute: false,
					closesAtLabel: ''
				},
				requests: [],
				positions: [],
				canManage: true,
				editable: false,
				playable: true,
				sheet
			},
			form: null,
			params: { id: game.id }
		}
	}).body;
}

describe('feuille de match terminée', () => {
	it('garde une seule ligne de centre et un seul libellé final', () => {
		const body = completedBody();
		const sheetHeader = body.slice(body.indexOf(`<h2>${t('gamesheet.title')}</h2>`));
		const header = sheetHeader.slice(0, sheetHeader.indexOf('</header>'));

		expect(body.match(/h-8 w-px bg-paper\/25/g)).toHaveLength(1);
		expect(body).not.toContain(t('gamesheet.finalized'));
		expect(header.match(new RegExp(t('games.status.completed'), 'g'))).toHaveLength(1);
	});

	it('laisse le trait au balisage, pas au pseudo-élément du tableau', () => {
		const css = readFileSync(new URL('../../layout.css', import.meta.url), 'utf8');
		const sheetSource = readFileSync(
			new URL('../../../lib/ui/match/GameSheet.svelte', import.meta.url),
			'utf8'
		);

		expect(css).not.toContain('.scoreboard-split::after');
		expect(sheetSource).toContain('scoreboard-split');
		expect(sheetSource).not.toContain("t('gamesheet.finalized')");
	});
});
