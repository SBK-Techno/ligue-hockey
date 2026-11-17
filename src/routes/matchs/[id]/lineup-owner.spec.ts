import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { GameView } from '#lib/domain/games/service.ts';
import type { LineupIntelligence } from '#lib/domain/games/alignment.ts';
import type { AvailabilityView } from '#lib/domain/availability/service.ts';
import AdminMatchPage from '../../admin/matchs/[id]/+page.svelte';
import MatchPage from './+page.svelte';

const game: GameView = {
	id: 'game-1',
	gameDate: '2026-11-15',
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

const intelligence: LineupIntelligence = {
	complete: true,
	openSlots: 0,
	placed: 0,
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	averages: { white: null, black: null },
	sizes: { white: 0, black: 0 },
	swap: null,
	fills: { count: 0, names: [] },
	benchNames: [],
	unratedNames: []
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

const availability: AvailabilityView = {
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
};

function generateControls(body: string): number {
	return body.match(/action="\?\/generate"/g)?.length ?? 0;
}

function renderPublic(overrides: Partial<GameView> = {}) {
	return render(MatchPage, {
		props: {
			data: {
				...layout,
				game: { ...game, ...overrides },
				availability,
				requests: [],
				positions: [],
				canManage: true,
				editable: true,
				playable: false,
				sheet: null
			},
			form: null,
			params: { id: game.id }
		}
	});
}

describe('propriétaire de la régénération d’alignement', () => {
	it('garde une seule commande de régénération pour un gérant', () => {
		const publicPage = render(MatchPage, {
			props: {
				data: {
					...layout,
					game,
					availability,
					requests: [],
					positions: [],
					canManage: true,
					editable: true,
					playable: false,
					sheet: null
				},
				form: null,
				params: { id: game.id }
			}
		});
		const adminPage = render(AdminMatchPage, {
			props: {
				data: {
					...layout,
					game,
					canAssess: false,
					canManage: true,
					editable: true,
					intelligence,
					ratingsMissing: [],
					locations: []
				},
				form: null,
				params: { id: game.id }
			}
		});

		expect(generateControls(publicPage.body)).toBe(1);
		expect(generateControls(adminPage.body)).toBe(0);
	});

	it('affiche l’avis d’annulation une seule fois, et seulement pour un match annulé', () => {
		const cancelled = renderPublic({ status: 'cancelled' });
		const scheduled = renderPublic({ status: 'scheduled' });

		expect(cancelled.body.split(t('games.cancelledNotice'))).toHaveLength(2);
		expect(scheduled.body).not.toContain(t('games.cancelledNotice'));
	});

	it('garde le banc dans la carte d’alignement, sans le répéter', () => {
		const benchPlayer = {
			playerId: 'bench-1',
			fullName: 'Remplaçant Test',
			position: 'forward' as const,
			jerseyNumber: 15,
			avatarId: null,
			kind: 'regular' as const
		};
		const page = renderPublic({
			generation: { ...game.generation!, bench: [benchPlayer] }
		});

		expect(page.body.split(t('rink.bench'))).toHaveLength(2);
		expect(page.body.split(benchPlayer.fullName)).toHaveLength(2);
	});

	it('rend la rétroaction d’alignement dans sa carte, avec une cible de focus', () => {
		const message = t('rink.invalid');
		const page = render(MatchPage, {
			props: {
				data: {
					...layout,
					game,
					availability,
					requests: [],
					positions: [],
					canManage: true,
					editable: true,
					playable: false,
					sheet: null
				},
				form: { ok: false, section: 'lineup', message },
				params: { id: game.id }
			}
		});
		const feedback = page.body.indexOf(message);
		const title = page.body.indexOf(t('games.roster'));
		const card = page.body.lastIndexOf('<section class="sheet', feedback);

		expect(title).toBeGreaterThan(-1);
		expect(feedback).toBeGreaterThan(title);
		expect(card).toBeGreaterThan(-1);
		expect(page.body.slice(card, feedback)).not.toContain('</section>');
		expect(page.body.slice(feedback - 300, feedback)).toContain('tabindex="-1"');
		expect(page.body.split(message)).toHaveLength(2);
	});
});
