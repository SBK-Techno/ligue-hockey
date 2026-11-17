import { describe, expect, it } from 'vitest';
import {
	composeHome,
	PANEL_SPANS,
	type ActionKind,
	type HeroVariant,
	type HomeCompositionInput,
	type HomeMode,
	type PanelKind,
	type PanelSpan
} from './composition.ts';

const base: HomeCompositionInput = {
	hasPlayerProfile: true,
	isSubstitute: false,
	canManageGames: false,
	canEditRatings: false,
	hasGame: true,
	gameToday: false,
	gameStatus: 'scheduled',
	availability: { own: 'present', canRespond: true, canWithdraw: false },
	teamsGenerated: false,
	ownSlot: false,
	ownRequestOpen: false,
	claimableCount: 0,
	balance: null,
	evaluationsPending: false,
	openPoll: null,
	latestMessage: false,
	otherUpcomingGames: 0
};

type Case = {
	name: string;
	input: Partial<HomeCompositionInput>;
	mode: HomeMode;
	hero: HeroVariant;
	manager: boolean;
	actions: ActionKind[];
	panels: PanelKind[];
	spans: PanelSpan[];
};

const cases: Case[] = [
	{
		name: 'un joueur sans fiche de joueur reçoit seulement la surface de profil',
		input: { hasPlayerProfile: false },
		mode: 'no-profile',
		hero: 'profile',
		manager: false,
		actions: [],
		panels: ['install'],
		spans: [12]
	},
	{
		name: 'un gestionnaire sans fiche garde le bandeau et le calendrier',
		input: { hasPlayerProfile: false, canManageGames: true },
		mode: 'no-profile',
		hero: 'profile',
		manager: true,
		actions: [],
		panels: ['manager', 'agenda', 'install'],
		spans: [12, 12, 12]
	},
	{
		name: 'aucun match mène le calendrier du mois',
		input: {
			hasGame: false,
			gameStatus: null,
			availability: null,
			teamsGenerated: false,
			otherUpcomingGames: 0
		},
		mode: 'no-game',
		hero: 'no-game',
		manager: false,
		actions: [],
		panels: ['agenda', 'install'],
		spans: [12, 12]
	},
	{
		name: 'aucun match avec un solde en retard garde les actions réelles',
		input: {
			hasGame: false,
			gameStatus: null,
			availability: null,
			teamsGenerated: false,
			balance: { outstandingCents: 12_500, isOverdue: true },
			openPoll: { unvoted: true },
			latestMessage: true
		},
		mode: 'no-game',
		hero: 'no-game',
		manager: false,
		actions: ['balance', 'poll'],
		panels: ['agenda', 'actions', 'league', 'install'],
		spans: [8, 4, 12, 12]
	},
	{
		name: 'sans match ni action, la discussion occupe la colonne libre',
		input: {
			hasGame: false,
			gameStatus: null,
			availability: null,
			teamsGenerated: false,
			latestMessage: true
		},
		mode: 'no-game',
		hero: 'no-game',
		manager: false,
		actions: [],
		panels: ['agenda', 'league', 'install'],
		spans: [8, 4, 12]
	},
	{
		name: 'le jour du match, la présence inconnue passe par la tête',
		input: {
			gameToday: true,
			availability: { own: null, canRespond: true, canWithdraw: false },
			otherUpcomingGames: 2
		},
		mode: 'game-day',
		hero: 'today',
		manager: false,
		actions: [],
		panels: ['upcoming', 'attendance', 'install'],
		spans: [12, 12, 12]
	},
	{
		name: 'le jour du match avec alignement garde la feuille à côté des trois suivants',
		input: {
			gameToday: true,
			teamsGenerated: true,
			ownSlot: true,
			otherUpcomingGames: 1
		},
		mode: 'game-day',
		hero: 'today',
		manager: false,
		actions: [],
		panels: ['team', 'upcoming', 'attendance', 'install'],
		spans: [5, 7, 12, 12]
	},
	{
		name: 'une présence ouverte sans réponse devient la surface de présence',
		input: {
			availability: { own: null, canRespond: true, canWithdraw: false }
		},
		mode: 'presence',
		hero: 'upcoming',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'install'],
		spans: [7, 5, 12]
	},
	{
		name: 'une présence confirmée sans alignement annonce la suite',
		input: { availability: { own: 'present', canRespond: true, canWithdraw: false } },
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'install'],
		spans: [7, 5, 12]
	},
	{
		name: 'un joueur aligné voit son équipe et sa ligne',
		input: {
			availability: { own: 'present', canRespond: true, canWithdraw: false },
			teamsGenerated: true,
			ownSlot: true
		},
		mode: 'lineup',
		hero: 'upcoming',
		manager: false,
		actions: [],
		panels: ['team', 'agenda', 'attendance', 'install'],
		spans: [5, 7, 12, 12]
	},
	{
		name: 'un joueur sur le banc garde le panneau équipe, sans phrase de place',
		input: {
			availability: { own: 'present', canRespond: true, canWithdraw: false },
			teamsGenerated: true,
			ownSlot: false
		},
		mode: 'lineup',
		hero: 'upcoming',
		manager: false,
		actions: [],
		panels: ['team', 'agenda', 'attendance', 'install'],
		spans: [5, 7, 12, 12]
	},
	{
		name: 'un joueur aligné avec un solde garde son équipe à côté des actions',
		input: {
			availability: { own: 'present', canRespond: true, canWithdraw: false },
			teamsGenerated: true,
			ownSlot: true,
			balance: { outstandingCents: 4_000, isOverdue: false }
		},
		mode: 'lineup',
		hero: 'upcoming',
		manager: false,
		actions: ['balance'],
		panels: ['team', 'actions', 'agenda', 'attendance', 'install'],
		spans: [5, 7, 7, 5, 12]
	},
	{
		name: 'une absence sans demande ne crée aucune action',
		input: { availability: { own: 'absent', canRespond: true, canWithdraw: false } },
		mode: 'absent',
		hero: 'absent',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'install'],
		spans: [7, 5, 12]
	},
	{
		name: 'une absence avec demande garde le statut dans la tête, pas dans les actions',
		input: {
			availability: { own: 'absent', canRespond: true, canWithdraw: false },
			ownRequestOpen: true
		},
		mode: 'absent',
		hero: 'absent',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'install'],
		spans: [7, 5, 12]
	},
	{
		name: 'le jour du match, une absence avec demande reste dans la tête',
		input: {
			gameToday: true,
			availability: { own: 'absent', canRespond: true, canWithdraw: false },
			ownRequestOpen: true
		},
		mode: 'game-day',
		hero: 'today',
		manager: false,
		actions: [],
		panels: ['attendance', 'install'],
		spans: [12, 12]
	},
	{
		name: 'un remplaçant avec une place ouverte la prend depuis les actions',
		input: {
			isSubstitute: true,
			availability: { own: null, canRespond: false, canWithdraw: false },
			claimableCount: 1
		},
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: ['claim'],
		panels: ['actions', 'agenda', 'attendance', 'install'],
		spans: [12, 7, 5, 12]
	},
	{
		name: 'un remplaçant avec deux places garde la liste dans le panneau',
		input: {
			isSubstitute: true,
			availability: { own: null, canRespond: false, canWithdraw: false },
			claimableCount: 2
		},
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: ['claim'],
		panels: ['actions', 'agenda', 'attendance', 'substitutes', 'install'],
		spans: [12, 7, 5, 12, 12]
	},
	{
		name: 'trois actions maximum, dans l’ordre du retard, de la demande et de l’évaluation',
		input: {
			balance: { outstandingCents: 8_000, isOverdue: true },
			canEditRatings: true,
			evaluationsPending: true,
			ownRequestOpen: true,
			openPoll: { unvoted: true }
		},
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: ['balance', 'own-request', 'evaluations'],
		panels: ['actions', 'agenda', 'attendance', 'poll', 'install'],
		spans: [12, 7, 5, 12, 12]
	},
	{
		name: 'une place à prendre passe avant un solde dû et un sondage',
		input: {
			isSubstitute: true,
			availability: { own: null, canRespond: false, canWithdraw: false },
			balance: { outstandingCents: 8_000, isOverdue: false },
			claimableCount: 1,
			openPoll: { unvoted: true }
		},
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: ['claim', 'balance', 'poll'],
		panels: ['actions', 'agenda', 'attendance', 'install'],
		spans: [12, 7, 5, 12]
	},
	{
		name: 'un sondage et une liste de remplaçants ferment les lignes complètes',
		input: {
			teamsGenerated: true,
			isSubstitute: true,
			claimableCount: 2,
			openPoll: { unvoted: false }
		},
		mode: 'lineup',
		hero: 'upcoming',
		manager: false,
		actions: ['claim'],
		panels: ['team', 'actions', 'agenda', 'attendance', 'poll', 'substitutes', 'install'],
		spans: [5, 7, 7, 5, 12, 12, 12]
	},
	{
		name: 'un gestionnaire ajoute son bandeau au-dessus du membre',
		input: { canManageGames: true },
		mode: 'announced',
		hero: 'upcoming',
		manager: true,
		actions: [],
		panels: ['manager', 'agenda', 'attendance', 'install'],
		spans: [12, 7, 5, 12]
	},
	{
		name: 'sans action ni sondage, le dernier message occupe le panneau discussion',
		input: { latestMessage: true },
		mode: 'announced',
		hero: 'upcoming',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'league', 'install'],
		spans: [7, 5, 12, 12]
	},
	{
		name: 'un match annulé change la tête sans changer la situation du membre',
		input: { gameStatus: 'cancelled' },
		mode: 'announced',
		hero: 'cancelled',
		manager: false,
		actions: [],
		panels: ['agenda', 'attendance', 'install'],
		spans: [7, 5, 12]
	},
	{
		name: 'un gestionnaire sans match crée depuis la tête, sans bandeau vide',
		input: {
			hasGame: false,
			gameStatus: null,
			availability: null,
			teamsGenerated: false,
			canManageGames: true
		},
		mode: 'no-game',
		hero: 'no-game',
		manager: false,
		actions: [],
		panels: ['agenda', 'install'],
		spans: [12, 12]
	},
	{
		name: 'le jour du match, l’équipe, la présence et le sondage se partagent la grille',
		input: {
			gameToday: true,
			teamsGenerated: true,
			ownSlot: true,
			otherUpcomingGames: 2,
			openPoll: { unvoted: false }
		},
		mode: 'game-day',
		hero: 'today',
		manager: false,
		actions: [],
		panels: ['team', 'upcoming', 'attendance', 'poll', 'install'],
		spans: [5, 7, 5, 7, 12]
	},
	{
		name: 'un remplaçant dans un alignement publié garde ses places dans son panneau',
		input: {
			isSubstitute: true,
			teamsGenerated: true,
			ownSlot: true,
			claimableCount: 2
		},
		mode: 'lineup',
		hero: 'upcoming',
		manager: false,
		actions: ['claim'],
		panels: ['team', 'actions', 'agenda', 'attendance', 'substitutes', 'install'],
		spans: [5, 7, 7, 5, 12, 12]
	}
];

describe('composition de l’accueil', () => {
	it.each(cases)('$name', ({ input, mode, hero, manager, actions, panels, spans }) => {
		const result = composeHome({ ...base, ...input });

		expect(result.mode).toBe(mode);
		expect(result.hero).toBe(hero);
		expect(result.manager).toBe(manager);
		expect(result.actions.map((action) => action.kind)).toEqual(actions);
		expect(result.panels.map((panel) => panel.kind)).toEqual(panels);
		expect(result.panels.map((panel) => panel.span)).toEqual(spans);

		const kinds = result.panels.map((panel) => panel.kind);
		expect(new Set(kinds).size).toBe(kinds.length);
		expect(result.panels.at(-1)?.kind).toBe('install');
		expect(kinds.includes('agenda') && kinds.includes('upcoming')).toBe(false);
		for (const panel of result.panels) {
			expect(PANEL_SPANS).toContain(panel.span);
		}
	});
});

describe('largeur de la grille d’accueil', () => {
	it('ferme chaque ligne à douze colonnes, dans tous les cas', () => {
		for (const entry of cases) {
			const { panels } = composeHome({ ...base, ...entry.input });
			let row = 0;
			for (const { span } of panels) {
				row += span;
				if (row === 12) row = 0;
				else if (row > 12) {
					throw new Error(`${entry.name}: la ligne dépasse douze colonnes (${row})`);
				}
			}
			expect(row, entry.name).toBe(0);
		}
	});
});
