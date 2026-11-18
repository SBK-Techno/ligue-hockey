import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { t } from '#lib/shared/i18n/index.ts';
import type { LineupIntelligence } from '#lib/domain/games/alignment.ts';
import type { GameView, TeamHistoryEntry } from '#lib/domain/games/service.ts';
import type { GameSlotView } from '#lib/domain/games/types.ts';
import type { AvailabilityView } from '#lib/domain/availability/service.ts';
import AdminMatchPage from '../../admin/matchs/[id]/+page.svelte';
import MatchPage from '../../matchs/[id]/+page.svelte';
import TeamPage from './+page.svelte';

const slots: GameSlotView[] = [
	{
		team: 'white',
		position: 'forward',
		slotIndex: 0,
		player: {
			playerId: 'white-player',
			fullName: 'Blanche Test',
			position: 'forward',
			jerseyNumber: 9,
			avatarId: null,
			kind: 'regular'
		}
	},
	{
		team: 'black',
		position: 'defense',
		slotIndex: 0,
		player: {
			playerId: 'manager',
			fullName: 'Gérant Test',
			position: 'defense',
			jerseyNumber: 4,
			avatarId: null,
			kind: 'regular'
		}
	}
];

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
	slots,
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
	placed: 2,
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	averages: { white: null, black: null },
	sizes: { white: 1, black: 1 },
	swap: null,
	fills: { count: 0, names: [] },
	benchNames: [],
	unratedNames: []
};

const history: TeamHistoryEntry[] = [
	{
		id: 'game-0',
		gameDate: '2026-11-15',
		startTime: '08:30',
		locationId: 'loc-1',
		location: 'Complexe sportif de Sainte-Foy',
		status: 'completed',
		generated: true,
		openSlots: 0,
		openSlotsLabel: '',
		counts: { white: 6, black: 7 }
	}
];

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

function teamData(overrides: Record<string, unknown> = {}) {
	return {
		...layout,
		game,
		canManage: true,
		editable: true,
		hasPlayerProfile: true,
		ownTeam: 'black' as const,
		intelligence,
		history,
		hasMoreHistory: false,
		nextGameId: game.id,
		isNext: true,
		isPastGame: false,
		...overrides
	};
}

function renderTeam(
	overrides: Record<string, unknown> = {},
	form: { ok: boolean; section: string; message: string } | null = null
) {
	return render(TeamPage, {
		props: {
			data: teamData(overrides),
			form,
			params: { id: game.id }
		}
	});
}

function renderMatch(
	overrides: Partial<GameView> = {},
	availabilityView: AvailabilityView = availability
) {
	return render(MatchPage, {
		props: {
			data: {
				...layout,
				detailTitle: 'Match',
				game: { ...game, ...overrides },
				availability: availabilityView,
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

function renderAdmin() {
	return render(AdminMatchPage, {
		props: {
			data: {
				...layout,
				detailTitle: 'Match',
				game,
				canAssess: false,
				canManage: true,
				editable: true,
				locations: []
			},
			form: null,
			params: { id: game.id }
		}
	});
}

function count(body: string, pattern: RegExp): number {
	return body.match(pattern)?.length ?? 0;
}

describe('propriétaire de l’alignement', () => {
	it('garde une seule commande de régénération, dans Équipes', () => {
		const team = renderTeam();
		const match = renderMatch();
		const admin = renderAdmin();

		expect(count(team.body, /action="\?\/generate"/g)).toBe(1);
		expect(count(match.body, /action="\?\/generate"/g)).toBe(0);
		expect(count(admin.body, /action="\?\/generate"/g)).toBe(0);

		expect(count(team.body, /action="\?\/lineup"/g)).toBe(1);
		expect(count(match.body, /action="\?\/lineup"/g)).toBe(0);
		expect(count(admin.body, /action="\?\/lineup"/g)).toBe(0);
	});

	it('garde l’éditeur et l’équilibre dans la section Équipes', () => {
		const team = renderTeam();
		const match = renderMatch();
		const admin = renderAdmin();

		expect(team.body).toContain(t('teams.managerTitle'));
		expect(team.body).toContain(t('games.roster'));
		expect(team.body).toContain(t('games.regenerate'));
		expect(team.body).toContain(t('rink.save'));

		expect(match.body).not.toContain(t('games.roster'));
		expect(match.body).not.toContain(t('games.regenerate'));
		expect(admin.body).not.toContain(t('games.roster'));
		expect(admin.body).not.toContain(t('games.regenerate'));
	});

	it('renvoie le match et l’administration vers Équipes', () => {
		const match = renderMatch();
		const admin = renderAdmin();

		expect(match.body).toContain('href="/equipes/game-1"');
		expect(match.body).toContain(t('home.team'));
		expect(admin.body).toContain('href="/equipes/game-1"');
		expect(admin.body).toContain(t('teams.manage'));
	});

	it('ne demande pas d’équipe pour un match annulé', () => {
		const team = renderTeam({
			game: { ...game, status: 'cancelled', generated: false, generation: null },
			editable: false,
			canManage: true
		});
		const match = renderMatch({ status: 'cancelled', generated: false, generation: null });

		expect(team.body).toContain(t('games.cancelledNotice'));
		expect(team.body).not.toContain(t('games.roster'));
		expect(count(team.body, /action="\?\/generate"/g)).toBe(0);
		expect(match.body).not.toContain(t('games.roster'));
	});

	it('ne présente pas un match annulé comme le prochain match', () => {
		const team = renderTeam({
			game: { ...game, status: 'cancelled' },
			editable: false,
			isNext: true
		});

		expect(team.body).toContain(t('teams.selectedMatch'));
		expect(team.body).not.toContain(t('teams.nextMatch'));
		expect(team.body).not.toContain(t('games.next'));
		expect(team.body).toContain(t('games.cancelledNotice'));
	});

	it('nomme un match commencé comme passé, jamais comme à venir', () => {
		const team = renderTeam({
			game: { ...game, status: 'scheduled' },
			editable: false,
			isNext: false,
			isPastGame: true
		});

		expect(team.body).toContain(t('teams.pastMatch'));
		expect(team.body).toContain(t('teams.lockedHelp'));
		expect(team.body).not.toContain(t('games.status.scheduled'));
	});

	it('garde un match passé lisible sans commande', () => {
		const team = renderTeam({
			game: { ...game, status: 'completed', completedAt: 1 },
			editable: false,
			isNext: false
		});

		expect(team.body).toContain(t('games.roster'));
		expect(team.body).toContain(t('teams.pastHelp'));
		expect(team.body).toContain('Blanche Test');
		expect(team.body).toContain('Gérant Test');
		expect(count(team.body, /action="\?\/lineup"/g)).toBe(0);
		expect(count(team.body, /action="\?\/generate"/g)).toBe(0);
	});

	it('nomme chaque match passé et ses deux compteurs', () => {
		const team = renderTeam();

		expect(team.body).toContain('href="/equipes/game-0"');
		expect(team.body).toContain('Complexe sportif de Sainte-Foy');
		expect(team.body).toContain(t('team.white.short'));
		expect(team.body).toContain(t('team.black.short'));
		expect(team.body).toContain('>6<');
		expect(team.body).toContain('>7<');
	});

	it('nomme les joueurs sans note sans retirer la régénération', () => {
		const team = renderTeam({
			intelligence: { ...intelligence, unratedNames: ['Sans Note'] }
		});

		expect(team.body).toContain(t('games.ratingsMissing'));
		expect(team.body).toContain('Sans Note');
		expect(team.body).toContain(t('games.regenerate'));
		expect(count(team.body, /action="\?\/generate"/g)).toBe(1);
	});

	it('garde le banc dans l’éditeur, sans le répéter', () => {
		const benchPlayer = {
			playerId: 'bench-1',
			fullName: 'Remplaçant Test',
			position: 'forward' as const,
			jerseyNumber: 15,
			avatarId: null,
			kind: 'regular' as const
		};
		const team = renderTeam({
			game: { ...game, generation: { ...game.generation!, bench: [benchPlayer] } }
		});

		expect(team.body.split(t('rink.bench'))).toHaveLength(2);
		expect(team.body.split('data-lineup-key="bench:bench-1"')).toHaveLength(2);
	});

	it('rend la rétroaction d’alignement dans sa carte, avec une cible de focus', () => {
		const message = t('rink.invalid');
		const team = renderTeam({}, { ok: false, section: 'lineup', message });
		const title = team.body.indexOf(`<h2>${t('games.roster')}</h2>`);
		const start = team.body.lastIndexOf('<section', title);
		const end = team.body.indexOf('</section>', title);
		const card = team.body.slice(start, end);

		expect(title).toBeGreaterThan(-1);
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(title);
		expect(card).toContain(message);
		expect(card).toContain('tabindex="-1"');
		expect(team.body.split(message)).toHaveLength(2);
	});

	it('donne au joueur une équipe en lecture seule, sans commande de gestion', () => {
		const team = renderTeam({ canManage: false });

		expect(team.body).toContain('Blanche Test');
		expect(team.body).toContain('Gérant Test');
		expect(team.body).toContain(t('team.white'));
		expect(team.body).not.toContain(t('teams.managerTitle'));
		expect(count(team.body, /action="\?\/generate"/g)).toBe(0);
		expect(count(team.body, /action="\?\/lineup"/g)).toBe(0);
	});

	it('annonce un alignement incomplet sans le présenter comme publié', () => {
		const team = renderTeam({
			canManage: false,
			game: {
				...game,
				lineupComplete: false,
				openSlots: 1,
				openSlotsLabel: '1 place ouverte'
			}
		});

		expect(team.body).toContain(t('games.rosterIncomplete'));
		expect(team.body).toContain('1 place ouverte');
		expect(team.body).not.toContain(t('games.generated'));
	});

	it('explique qu’un match passé n’a jamais reçu d’équipe', () => {
		const team = renderTeam({
			game: {
				...game,
				status: 'completed',
				generated: false,
				generation: null,
				completedAt: 1
			},
			editable: false,
			isNext: false,
			isPastGame: true
		});

		expect(team.body).toContain(t('teams.noLineupPast'));
		expect(team.body).not.toContain(t('games.lineupSoonAdmin'));
		expect(count(team.body, /action="\?\/generate"/g)).toBe(0);
	});

	it('garde le banc visible et nomme le joueur qui y est', () => {
		const benchPlayer = {
			playerId: 'manager',
			fullName: 'Gérant Test',
			position: 'defense' as const,
			jerseyNumber: 4,
			avatarId: null,
			kind: 'regular' as const
		};
		const team = renderTeam({
			canManage: false,
			game: { ...game, generation: { ...game.generation!, bench: [benchPlayer] } }
		});

		expect(team.body.split(t('rink.bench'))).toHaveLength(2);
		expect(team.body.split(t('common.you')).length).toBeGreaterThan(1);
	});

	it('termine la phrase de l’historique sans répéter Matchs', () => {
		const team = renderTeam({
			hasMoreHistory: true,
			history: [{ ...history[0], id: game.id }, ...history]
		});

		expect(team.body).toContain(t('teams.historyMore'));
		expect(team.body).not.toContain(t('games.title') + '. ' + t('games.title'));
		expect(team.body).toContain('aria-current="page"');
	});

	it('refait les équipes en un clic, sans confirmation intermédiaire', () => {
		const team = renderTeam();
		const start = team.body.indexOf('action="?/generate"');
		const end = team.body.indexOf('</form>', start);
		const form = team.body.slice(start, end);

		expect(start).toBeGreaterThan(-1);
		expect(form).toContain('type="submit"');
		expect(form).not.toContain('type="button"');
		expect(team.body).toContain('class="btn-primary btn-sm"');
	});

	it('mesure l’équilibre à côté de la glace, pas dans un panneau lointain', () => {
		const team = renderTeam({
			game: {
				...game,
				generation: {
					...game.generation!,
					skillDiffLabel: '0,25',
					ageDiffLabel: '1,0'
				}
			}
		});

		expect(team.body).toContain('class="metric-strip"');
		expect(team.body).toContain(t('games.gapSkill'));
		expect(team.body).toContain(t('games.gapAge'));
		expect(team.body).toContain(t('team.white'));
		expect(team.body).toContain(t('team.black'));

		const rosterTitle = team.body.indexOf(`<h2>${t('games.roster')}</h2>`);
		const strip = team.body.indexOf('class="metric-strip"');
		const board = team.body.indexOf(t('rink.board'));
		expect(rosterTitle).toBeGreaterThan(-1);
		expect(strip).toBeGreaterThan(rosterTitle);
		expect(board).toBeGreaterThan(strip);
	});

	it('garde les commandes de présence sur le match, jamais l’alignement', () => {
		const match = renderMatch({}, {
			...availability,
			rows: [{ playerId: 'present-1', fullName: 'Présent Test', status: 'present' }],
			present: 1,
			canRespond: true
		});
		const presence = match.body.indexOf(t('home.availability'));
		const attendance = match.body.indexOf(t('home.attendance'));

		expect(presence).toBeGreaterThan(-1);
		expect(presence).toBeLessThan(attendance);
		expect(match.body).toContain('presence-strip');
		expect(match.body).toContain(t('availability.markPresent'));
		expect(match.body).toContain(t('availability.markAbsent'));
		expect(match.body).not.toContain(t('games.roster'));
	});
});
