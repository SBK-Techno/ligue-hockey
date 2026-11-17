import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GameView } from '#lib/domain/games/service.ts';
import type { SubRequestView } from '#lib/domain/subs/service.ts';
import MatchPage from './+page.svelte';

const game: GameView = {
	id: 'game-1',
	gameDate: '2026-11-22',
	startTime: '08:30',
	locationId: 'loc-1',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'scheduled',
	notes: null,
	locationAddress: null,
	locationMapUrl: null,
	slots: [],
	generation: {
		skillDiff: 0,
		ageDiff: 0,
		sizeDiff: 0,
		skillDiffLabel: null,
		ageDiffLabel: null,
		warnings: [],
		ruleViolations: [],
		bench: [],
		generatedAt: 1
	},
	completedAt: null,
	lineupManualAt: null,
	openSlots: 0,
	openSlotsLabel: '',
	lineupComplete: true,
	generated: true,
	updatedAt: 1
};

const request: SubRequestView = {
	id: 'request-1',
	gameId: game.id,
	position: 'forward',
	reason: 'manual',
	status: 'open',
	requestedByPlayerId: 'player-1',
	requestedByName: 'Alex Tremblay',
	filledByPlayerId: null,
	filledByName: null,
	createdAt: 1,
	filledAt: null,
	cancelledAt: null
};

const actor = {
	kind: 'user' as const,
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager' as const
};

const layout = {
	actor,
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

function body(): string {
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
				requests: [request],
				positions: [],
				canManage: true,
				editable: true,
				playable: false,
				sheet: null
			},
			form: null,
			params: { id: game.id }
		}
	}).body;
}

function form(html: string, action: string): string {
	const match = html.match(
		new RegExp(`<form[^>]*action="\\?\\/${action}"[^>]*>[\\s\\S]*?<\\/form>`)
	);
	expect(match, action).not.toBeNull();
	return match?.[0] ?? '';
}

describe('confirmation des actions destructives du match', () => {
	it('annule une demande seulement après la confirmation partagée', () => {
		const cancel = form(body(), 'cancelRequest');

		expect(cancel).toContain(t('subs.cancelRequest'));
		expect(cancel).toContain('type="button"');
		expect(cancel).not.toContain('type="submit"');
	});

	it('régénère l’alignement seulement après une confirmation qui le nomme', () => {
		const regenerate = form(body(), 'generate');

		expect(regenerate).toContain(t('games.regenerate'));
		expect(regenerate).toContain('type="button"');
		expect(regenerate).not.toContain('type="submit"');
		expect(t('games.regenerateConfirm')).toContain('alignement publié');
	});

	it('branche chaque confirmation sur la question partagée', () => {
		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

		expect(source).toContain("question={t('subs.cancelRequestConfirm')}");
		expect(source).toContain("question={t('games.regenerateConfirm')}");
	});
});
