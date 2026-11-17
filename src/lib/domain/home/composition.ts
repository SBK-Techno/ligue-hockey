/**
 * La page d'accueil est un tableau de situation, pas un tableau de bord.
 * Ce module pur choisit la surface de tête, les panneaux et leur largeur à
 * partir de la situation réelle du membre. La route ne décide rien : elle
 * traduit les services en entrée typée et rend le résultat.
 */
export const HOME_MODES = [
	'no-profile',
	'no-game',
	'game-day',
	'presence',
	'announced',
	'lineup',
	'absent'
] as const;

export type HomeMode = (typeof HOME_MODES)[number];

export type HeroVariant =
	| 'profile'
	| 'no-game'
	| 'today'
	| 'upcoming'
	| 'absent'
	| 'cancelled';

export const PANEL_KINDS = [
	'manager',
	'actions',
	'team',
	'calendar',
	'upcoming',
	'attendance',
	'poll',
	'substitutes',
	'league',
	'install'
] as const;

export type PanelKind = (typeof PANEL_KINDS)[number];

export const PANEL_SPANS = [12, 8, 7, 6, 5, 4] as const;

export type PanelSpan = (typeof PANEL_SPANS)[number];

export type HomePanel = {
	kind: PanelKind;
	span: PanelSpan;
};

export const ACTION_KINDS = [
	'balance',
	'evaluations',
	'poll',
	'own-request',
	'claim'
] as const;

export type ActionKind = (typeof ACTION_KINDS)[number];

export type HomeAction = {
	kind: ActionKind;
};

export type HomeAvailabilityInput = {
	own: 'present' | 'absent' | null;
	canRespond: boolean;
	canWithdraw: boolean;
};

export type HomeGameStatus = 'scheduled' | 'cancelled' | 'completed';

export type HomeCompositionInput = {
	hasPlayerProfile: boolean;
	isSubstitute: boolean;
	canManageGames: boolean;
	canEditRatings: boolean;
	hasGame: boolean;
	gameToday: boolean;
	gameStatus: HomeGameStatus | null;
	availability: HomeAvailabilityInput | null;
	teamsGenerated: boolean;
	ownSlot: boolean;
	ownRequestOpen: boolean;
	claimableCount: number;
	balance: { outstandingCents: number; isOverdue: boolean } | null;
	evaluationsPending: boolean;
	openPoll: { unvoted: boolean } | null;
	latestMessage: boolean;
	otherUpcomingGames: number;
};

export type HomeComposition = {
	mode: HomeMode;
	/** Le bandeau de gestion s'ajoute au-dessus de la grille, sans remplacer le membre. */
	manager: boolean;
	hero: HeroVariant;
	actions: HomeAction[];
	panels: HomePanel[];
};

type ActionCandidate = HomeAction & { urgency: number };

/**
 * L'urgence est une règle métier stable, testée. Un retard d'argent passe
 * avant une place à prendre, qui passe avant une demande déjà ouverte.
 */
const URGENCY: Record<ActionKind, number> = {
	balance: 4,
	evaluations: 3,
	poll: 5,
	'own-request': 2,
	claim: 1
};

function overdueUrgency(input: HomeCompositionInput): number {
	return input.balance?.isOverdue ? 0 : URGENCY.balance;
}

function selectMode(input: HomeCompositionInput): HomeMode {
	if (!input.hasPlayerProfile) return 'no-profile';
	if (!input.hasGame) return 'no-game';
	if (input.gameToday) return 'game-day';
	if (input.availability?.own === 'absent') return 'absent';
	if (input.availability?.canRespond && input.availability.own === null) return 'presence';
	if (input.teamsGenerated) return 'lineup';
	return 'announced';
}

function selectHero(input: HomeCompositionInput, mode: HomeMode): HeroVariant {
	if (mode === 'no-profile') return 'profile';
	if (mode === 'no-game') return 'no-game';
	if (input.gameStatus === 'cancelled') return 'cancelled';
	if (mode === 'game-day') return 'today';
	if (mode === 'absent') return 'absent';
	return 'upcoming';
}

function selectActions(input: HomeCompositionInput, mode: HomeMode): HomeAction[] {
	const candidates: ActionCandidate[] = [];

	if (input.balance && input.balance.outstandingCents > 0) {
		candidates.push({ kind: 'balance', urgency: overdueUrgency(input) });
	}
	if (input.canEditRatings && input.evaluationsPending) {
		candidates.push({ kind: 'evaluations', urgency: URGENCY.evaluations });
	}
	if (input.openPoll?.unvoted) {
		candidates.push({ kind: 'poll', urgency: URGENCY.poll });
	}
	// Quand le membre est absent, la surface de tête porte déjà l'état de sa
	// demande : une deuxième ligne dans les actions serait un doublon. Le jour
	// du match, la tête reste la surface de tête même si le mode est `game-day`.
	if (input.ownRequestOpen && mode !== 'absent' && input.availability?.own !== 'absent') {
		candidates.push({ kind: 'own-request', urgency: URGENCY['own-request'] });
	}
	if (input.claimableCount > 0) {
		candidates.push({ kind: 'claim', urgency: URGENCY.claim });
	}

	return candidates
		.sort((left, right) => left.urgency - right.urgency)
		.slice(0, 3)
		.map(({ kind }) => ({ kind }));
}

export function composeHome(input: HomeCompositionInput): HomeComposition {
	const mode = selectMode(input);
	const manager = input.canManageGames && input.hasGame;
	const actions = selectActions(input, mode);
	const actioned = new Set(actions.map((action) => action.kind));

	const pollPanel = Boolean(input.openPoll) && !actioned.has('poll');
	const leaguePanel = input.latestMessage && actions.length === 0 && !pollPanel;

	const claimInActions = actioned.has('claim');
	const ownRequestInActions = actioned.has('own-request');

	const substitutesPanel =
		input.hasGame &&
		((input.isSubstitute && input.claimableCount > (claimInActions ? 1 : 0)) ||
			(input.ownRequestOpen &&
				!ownRequestInActions &&
				mode !== 'absent' &&
				input.availability?.own !== 'absent'));

	const teamPanel =
		input.hasGame &&
		input.teamsGenerated &&
		input.hasPlayerProfile &&
		input.availability?.own !== 'absent';

	const calendarPanel = input.hasGame
		? !input.gameToday
		: input.hasPlayerProfile;

	const upcomingPanel = input.gameToday && input.otherUpcomingGames > 0;

	const attendancePanel =
		input.hasGame && input.hasPlayerProfile && input.availability !== null;

	const panels: HomePanel[] = [];
	const add = (kind: PanelKind, span: PanelSpan) => panels.push({ kind, span });

	if (manager) add('manager', 12);

	if (mode === 'no-profile') {
		if (manager && calendarPanel) add('calendar', 12);
		add('install', 12);
		return { mode, manager, hero: selectHero(input, mode), actions, panels };
	}

	if (mode === 'no-game') {
		const side = actions.length > 0 || pollPanel || leaguePanel;
		add('calendar', side ? 8 : 12);
		if (actions.length > 0) add('actions', 4);
		if (pollPanel) add('poll', actions.length > 0 ? 12 : 4);
		if (leaguePanel) add('league', 12);
		add('install', 12);
		return { mode, manager, hero: selectHero(input, mode), actions, panels };
	}

	if (mode === 'game-day') {
		if (actions.length > 0) add('actions', 12);

		if (teamPanel) {
			add('team', 5);
			if (upcomingPanel) add('upcoming', 7);
		} else if (upcomingPanel) {
			add('upcoming', 12);
		}

		if (attendancePanel) {
			if (pollPanel) {
				add('attendance', 5);
				add('poll', 7);
			} else {
				add('attendance', 12);
			}
		} else if (pollPanel) {
			add('poll', 12);
		}

		if (substitutesPanel) add('substitutes', 12);
		if (leaguePanel) add('league', 12);
		add('install', 12);
		return { mode, manager, hero: selectHero(input, mode), actions, panels };
	}

	if (mode === 'lineup') {
		if (teamPanel) add('team', 5);
		if (actions.length > 0) add('actions', teamPanel ? 7 : 12);
		if (calendarPanel) add('calendar', 7);

		if (attendancePanel && pollPanel) {
			add('attendance', 5);
			add('poll', 7);
		} else if (attendancePanel) {
			add('attendance', actions.length > 0 ? 5 : 12);
		} else if (pollPanel) {
			add('poll', 12);
		}
	} else {
		if (actions.length > 0) add('actions', 12);
		if (calendarPanel) add('calendar', 7);
		if (attendancePanel) add('attendance', 5);

		if (pollPanel && substitutesPanel) {
			add('poll', 6);
			add('substitutes', 6);
		} else if (pollPanel) {
			add('poll', 12);
		} else if (substitutesPanel) {
			add('substitutes', 12);
		}
	}

	if (mode === 'lineup' && substitutesPanel) add('substitutes', 12);
	if (leaguePanel) add('league', 12);
	add('install', 12);

	return { mode, manager, hero: selectHero(input, mode), actions, panels };
}
