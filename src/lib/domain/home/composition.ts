/**
 * La page d'accueil est un tableau de situation : une colonne principale
 * porte le match et la saison, une colonne de droite porte la présence, le
 * sondage et la discussion. Ce module pur choisit la surface de tête, les
 * panneaux, leur largeur de grille et leur colonne à partir de la situation
 * réelle du membre. La route ne décide rien : elle traduit les services en
 * entrée typée et rend le résultat.
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
	'agenda',
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

/** La colonne de droite reste une colonne de situation : on y lit et on y
 * répond, on n'y prépare pas le match. Chaque panneau appartient à une seule
 * colonne, et les deux colonnes réunies gardent l'ordre de la composition
 * pour que la version téléphone ne change pas. */
export type PanelZone = 'main' | 'rail';

export const PANEL_ZONES: Record<PanelKind, PanelZone> = {
	manager: 'main',
	actions: 'main',
	team: 'main',
	agenda: 'main',
	upcoming: 'main',
	attendance: 'rail',
	poll: 'rail',
	substitutes: 'rail',
	league: 'rail',
	install: 'rail'
};

export type HomePanel = {
	kind: PanelKind;
	span: PanelSpan;
	zone: PanelZone;
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
	const leaguePanel = input.latestMessage;

	const claimInActions = actioned.has('claim');
	const ownRequestInActions = actioned.has('own-request');

	const substitutesPanel =
		input.hasGame &&
		((input.isSubstitute && input.claimableCount > (claimInActions ? 1 : 0)) ||
			(input.ownRequestOpen &&
				!ownRequestInActions &&
				mode !== 'absent' &&
				input.availability?.own !== 'absent'));
	// Le sondage et la discussion ferment la page ensemble : deux panneaux
	// pleine largeur l'un sous l'autre laissaient une seule colonne visible
	// sur un écran large. Une liste de remplaçants garde sa propre ligne, et
	// le jour du match le sondage partage déjà la ligne des présences.
	const leagueBesidePoll =
		leaguePanel &&
		pollPanel &&
		!substitutesPanel &&
		(mode === 'lineup' || mode === 'announced' || mode === 'presence' || mode === 'absent');

	const teamPanel =
		input.hasGame &&
		input.teamsGenerated &&
		input.hasPlayerProfile &&
		input.availability?.own !== 'absent';

	const agendaPanel = input.hasGame
		? !input.gameToday
		: input.hasPlayerProfile;

	const upcomingPanel = input.gameToday && input.otherUpcomingGames > 0;

	const attendancePanel =
		input.hasGame && input.hasPlayerProfile && input.availability !== null;

	const panels: HomePanel[] = [];
	const add = (kind: PanelKind, span: PanelSpan) =>
		panels.push({ kind, span, zone: PANEL_ZONES[kind] });

	// Sans fiche de joueur, le gestionnaire n'a que le match à préparer et la
	// saison : sur un grand écran, les deux se lisent côte à côte au lieu de
	// s'empiler en deux bandeaux pleine largeur.
	const managerSpan: PanelSpan = mode === 'no-profile' && agendaPanel ? 5 : 12;
	if (manager) add('manager', managerSpan);

	if (mode === 'no-profile') {
		if (manager && agendaPanel) add('agenda', 7);
		add('install', 12);
		return { mode, manager, hero: selectHero(input, mode), actions, panels };
	}

	if (mode === 'no-game') {
		const side = actions.length > 0 || pollPanel || leaguePanel;
		add('agenda', side ? 8 : 12);
		if (actions.length > 0) add('actions', 4);
		if (pollPanel) add('poll', actions.length > 0 ? 12 : 4);
		// Seule à côté de l'agenda, la discussion occupe la colonne libre.
		if (leaguePanel) add('league', actions.length > 0 || pollPanel ? 12 : 4);
		add('install', 12);
		return { mode, manager, hero: selectHero(input, mode), actions, panels };
	}

	if (mode === 'game-day') {
		if (actions.length > 0) add('actions', 12);

		if (teamPanel) {
			// Sans match suivant à côté, l'équipe occupe la ligne : une
			// demi-largeur seule laisserait cinq colonnes vides.
			add('team', upcomingPanel ? 5 : 12);
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
		// L'agenda partage sa ligne avec les présences; sans présences, il
		// prend la ligne complète plutôt que de laisser une moitié vide.
		if (agendaPanel) add('agenda', attendancePanel ? 7 : 12);

		if (attendancePanel) add('attendance', actions.length > 0 ? 5 : 12);
		// Le sondage ferme la page avec la discussion quand elle est là.
		if (pollPanel) add('poll', leagueBesidePoll ? 6 : 12);
	} else {
		if (actions.length > 0) add('actions', 12);
		if (agendaPanel) add('agenda', attendancePanel ? 7 : 12);
		if (attendancePanel) add('attendance', 5);

		if (pollPanel && substitutesPanel) {
			add('poll', 6);
			add('substitutes', 6);
		} else if (pollPanel) {
			add('poll', leagueBesidePoll ? 6 : 12);
		} else if (substitutesPanel) {
			add('substitutes', 12);
		}
	}

	if (mode === 'lineup' && substitutesPanel) add('substitutes', 12);
	if (leaguePanel) add('league', leagueBesidePoll ? 6 : 12);
	add('install', 12);

	return { mode, manager, hero: selectHero(input, mode), actions, panels };
}
