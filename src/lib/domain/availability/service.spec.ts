import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * La date limite ferme l'inscription, pas la sortie. Ces tests figent la règle :
 * après la fermeture, on ne peut plus se déclarer présent, mais on peut encore
 * retirer sa présence pour ouvrir sa place à un remplaçant.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const h = vi.hoisted(() => ({
	now: 1_000_000_000_000,
	startMs: 1_000_000_000_000,
	previous: null as 'present' | 'absent' | null,
	setGamePresence: vi.fn(),
	createAbsenceRequest: vi.fn(),
	cancelForReturn: vi.fn(),
	regenerate: vi.fn()
}));

vi.mock('#lib/generated/branding.ts', () => ({
	branding: { timezone: 'America/Toronto', locale: 'fr-CA' }
}));

vi.mock('#lib/shared/time/clock.ts', () => ({
	clock: { nowMs: () => h.now },
	zonedDateTimeToMs: () => h.startMs
}));

vi.mock('#lib/shared/i18n/index.ts', () => ({
	t: (key: string) => key,
	formatCount: (count: number) => String(count),
	formatTimestamp: () => 'date'
}));

vi.mock('#lib/domain/auth/policy.ts', () => ({
	requireUser: () => ({ kind: 'user', active: true, userId: 'me', role: 'player', name: 'Moi' })
}));

vi.mock('#lib/domain/audit/service.ts', () => ({
	recordAudit: vi.fn()
}));

vi.mock('#lib/domain/games/service.ts', () => ({
	getGame: () => ({
		id: 'game_1',
		status: 'scheduled',
		gameDate: '2026-11-22',
		startTime: '09:00',
		location: 'Aréna'
	}),
	listGamePresence: () =>
		h.previous === null ? [] : [{ playerId: 'me', status: h.previous }],
	setGamePresence: h.setGamePresence,
	regenerateIfGenerated: h.regenerate
}));

vi.mock('#lib/domain/players/service.ts', () => ({
	getOwnProfile: () => ({
		userId: 'me',
		position: 'forward',
		isSubstitute: false
	}),
	findOwnProfile: () => ({ userId: 'me', position: 'forward', isSubstitute: false })
}));

vi.mock('#lib/domain/players/candidates.ts', () => ({
	generationCandidates: () => [],
	playersByIds: () => []
}));

vi.mock('#lib/domain/settings/service.ts', () => ({
	getSettings: () => ({
		'games.availabilityClosesHours': 24,
		'notifications.subRequestOnAbsence': true
	})
}));

vi.mock('#lib/domain/subs/service.ts', () => ({
	createAbsenceRequest: h.createAbsenceRequest,
	cancelForReturn: h.cancelForReturn
}));

const { availabilityForGame, markAvailability } = await import('./service.ts');

const actor = { kind: 'user', active: true, userId: 'me', role: 'player', name: 'Moi' } as never;

beforeEach(() => {
	h.setGamePresence.mockReset();
	h.createAbsenceRequest.mockReset();
	h.createAbsenceRequest.mockReturnValue({ id: 'sub_1' });
	h.cancelForReturn.mockReset();
	h.cancelForReturn.mockReturnValue(null);
	h.regenerate.mockReset();
	h.regenerate.mockReturnValue({ regenerated: false });
	h.previous = null;
	// Une heure avant le match : la date limite est passée.
	h.now = h.startMs - HOUR;
});

describe('markAvailability après la mise au jeu', () => {
	it('refuse une présence comme une absence', () => {
		h.now = h.startMs + HOUR;
		h.previous = 'present';
		for (const status of ['present', 'absent'] as const) {
			let error: unknown;
			try {
				markAvailability(actor, 'game_1', status);
			} catch (cause) {
				error = cause;
			}
			expect(error).toMatchObject({ code: 'CONFLICT', key: 'availability.gameClosed' });
		}
		expect(h.setGamePresence).not.toHaveBeenCalled();
		expect(h.createAbsenceRequest).not.toHaveBeenCalled();
	});

	it('n’offre plus le retrait une fois le match commencé', () => {
		h.now = h.startMs + HOUR;
		h.previous = 'present';

		const view = availabilityForGame(actor, {
			id: 'game_1',
			status: 'scheduled',
			gameDate: '2026-11-22',
			startTime: '09:00',
			locationId: 'arena',
			location: 'Aréna'
		});

		expect(view.canWithdraw).toBe(false);
	});
});

describe('markAvailability après la date limite', () => {
	it('refuse de se déclarer présent', () => {
		let error: unknown;
		try {
			markAvailability(actor, 'game_1', 'present');
		} catch (cause) {
			error = cause;
		}
		expect(error).toMatchObject({ code: 'CONFLICT', key: 'availability.locked' });
		expect(h.setGamePresence).not.toHaveBeenCalled();
	});

	it('accepte un retrait et ouvre une place de remplaçant', async () => {
		h.previous = 'present';

		const result = await markAvailability(actor, 'game_1', 'absent');

		expect(h.setGamePresence).toHaveBeenCalledWith('game_1', 'me', 'absent', h.now);
		expect(h.createAbsenceRequest).toHaveBeenCalledTimes(1);
		expect(result.messageKey).toBe('availability.savedRequested');
		expect(result.requestCreated).toBe(true);
	});

	it('n’ouvre pas de place si le joueur n’était pas attendu', async () => {
		h.previous = null;

		const result = await markAvailability(actor, 'game_1', 'absent');

		expect(h.createAbsenceRequest).not.toHaveBeenCalled();
		expect(result.messageKey).toBe('availability.absenceSaved');
		expect(result.requestCreated).toBe(false);
	});

	it('ouvre encore une place si le joueur était déjà absent par erreur', async () => {
		h.previous = 'absent';

		const result = await markAvailability(actor, 'game_1', 'absent');

		expect(h.createAbsenceRequest).not.toHaveBeenCalled();
		expect(result.messageKey).toBe('availability.absenceSaved');
	});
});

describe('markAvailability avant la date limite', () => {
	beforeEach(() => {
		// Deux jours avant : les présences sont ouvertes.
		h.now = h.startMs - 2 * DAY;
	});

	it('accepte une présence et retire le remplaçant s’il y en avait un', async () => {
		h.cancelForReturn.mockReturnValue('sub_player');

		const result = await markAvailability(actor, 'game_1', 'present');

		expect(h.setGamePresence).toHaveBeenCalledWith('game_1', 'me', 'present', h.now);
		expect(h.cancelForReturn).toHaveBeenCalledWith(actor, expect.anything(), 'me');
		expect(result.messageKey).toBe('availability.savedBumped');
		expect(result.bumpedPlayerId).toBe('sub_player');
	});
});
