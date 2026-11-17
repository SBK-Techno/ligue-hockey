import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AvailabilityView } from '#lib/domain/availability/service.ts';
import { t } from '#lib/shared/i18n/index.ts';
import AvailabilityRoster from '#lib/ui/AvailabilityRoster.svelte';
import SeasonAgenda from '#lib/ui/home/SeasonAgenda.svelte';
import AdminPage from './+page.svelte';

const availability: AvailabilityView = {
	rows: [{ playerId: 'player-1', fullName: 'Karim Haddad', status: 'present' }],
	pending: [{ playerId: 'player-2', fullName: 'Alex Tremblay' }],
	present: 1,
	absent: 0,
	unknown: 1,
	summary: '1 présent · 1 sans réponse',
	own: null,
	locked: false,
	canRespond: true,
	canWithdraw: false,
	substitute: false,
	closesAtLabel: '15 novembre'
};

const agendaGame = {
	id: 'game-1',
	gameDate: '2026-11-15',
	startTime: '08:30',
	location: 'Complexe sportif de Sainte-Foy',
	status: 'scheduled' as const,
	availability: null,
	requestOpen: false,
	score: null
};

function renderAdmin() {
	return render(AdminPage, {
		props: {
			data: {
				actor: { kind: 'user', active: true, userId: 'admin', name: 'Admin', role: 'admin' },
				unread: 0,
				hasPlayerProfile: true,
				isSubstitute: false,
				avatarId: null,
				peekScope: 'ratings',
				nav: {
					primary: [],
					mobile: [],
					account: null,
					roleLabelKey: 'admin.role.admin',
					unreadCap: 9 as const
				},
				counts: {
					active: 1,
					subs: 0,
					unpaid: 0,
					overdue: 0,
					noPlan: 0,
					openRequests: 0,
					unanswered: 1
				},
				currency: 'CAD',
				nextAvailability: null,
				nextGame: null,
				notifications: null,
				outstandingCents: 0,
				permissions: { players: true, balances: false, games: true, subs: false },
				players: [],
				balances: [],
				requests: [],
				unpaid: [],
				upcoming: [],
				withoutPlan: []
			},
			form: null,
			params: {}
		}
	});
}

describe('libellé unique de l’absence de réponse', () => {
	it('affiche les mêmes mots dans la feuille de présence, l’agenda et l’administration', () => {
		const roster = render(AvailabilityRoster, {
			props: { availability, viewerId: 'player-1' }
		});
		const agenda = render(SeasonAgenda, {
			props: { upcoming: [agendaGame], past: [{ ...agendaGame, status: 'completed' }] }
		});
		const admin = renderAdmin();

		expect(roster.body).toContain(t('availability.noAnswer'));
		expect(agenda.body).toContain(t('availability.noAnswer'));
		expect(admin.body).toContain(t('availability.noAnswer'));
	});
});
