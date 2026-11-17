import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../auth/types.ts';
import { resolveAvatarId } from './identity.ts';
import type { InsertPlayerResult, PlayerUpdateResult } from './queries.ts';

const row = {
	userId: 'me',
	firstName: 'Alex',
	lastName: 'Tremblay',
	email: 'alex@example.test',
	position: 'forward' as const,
	age: 32,
	jerseyNumber: 9,
	avatarId: null as string | null,
	isSubstitute: false,
	active: true,
	role: 'player' as const,
	createdAt: 0,
	updatedAt: 0
};

let usage: { userId: string; avatarId: string | null }[] = [];

const updatePlayer = vi.fn((...args: unknown[]): PlayerUpdateResult => {
	void args;
	return { status: 'updated', cleared: [] };
});
const insertPlayerWithNextAvatar = vi.fn((...args: unknown[]): InsertPlayerResult => {
	void args;
	return { status: 'inserted', avatarId: 'barbe-de-brique' };
});
const findPlayerWithEmail = vi.fn((...args: unknown[]) => {
	void args;
	return row;
});
const createUser = vi.fn(async (...args: unknown[]) => {
	void args;
	return { id: 'new-player' };
});
const deleteUser = vi.fn(async (...args: unknown[]) => {
	void args;
});
const requestPasswordReset = vi.fn(async (...args: unknown[]) => {
	void args;
});
const regenerateUpcomingGeneratedGames = vi.fn((...args: unknown[]) => {
	void args;
});

vi.mock('./queries.ts', () => ({
	findPlayer: () => row,
	findPlayerWithEmail: () => findPlayerWithEmail(),
	findPlayersByIds: () => [],
	hasFreeAvatarForPosition: () => true,
	insertPlayerWithNextAvatar: (...args: unknown[]) => insertPlayerWithNextAvatar(...args),
	countActiveAdmins: () => 1,
	listActivePlayers: () => [],
	listAllPlayersWithEmail: () => [row],
	listActiveAvatarAssignments: () => usage,
	updatePlayer: (...args: unknown[]) => updatePlayer(...args),
	deletePlayerAccount: vi.fn()
}));

vi.mock('#lib/domain/audit/service.ts', () => ({
	recordAudit: vi.fn()
}));

vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames: (...args: unknown[]) =>
		regenerateUpcomingGeneratedGames(...args)
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser,
			deleteUser,
			updateName: vi.fn(async () => undefined),
			setRole: vi.fn(),
			revokeSessions: vi.fn(async () => undefined),
			requestPasswordReset
		})
	};
});

const profileInput = {
	firstName: 'Alex',
	lastName: 'Tremblay',
	age: 32,
	position: 'forward' as const,
	jerseyNumber: 9
};

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'me',
	name: 'Alex Tremblay',
	role: 'player'
};
const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};

describe('service des identités', () => {
	beforeEach(() => {
		usage = [];
		updatePlayer.mockReset();
		updatePlayer.mockReturnValue({ status: 'updated', cleared: [] });
		insertPlayerWithNextAvatar.mockClear();
		findPlayerWithEmail.mockClear();
		findPlayerWithEmail.mockReturnValue(row);
		createUser.mockClear();
		deleteUser.mockClear();
		requestPasswordReset.mockClear();
		regenerateUpcomingGeneratedGames.mockClear();
	});

	it('transmet le choix d’identité à la transaction de réservation', async () => {
		const { updateOwnProfile } = await import('./service.ts');

		await updateOwnProfile(player, { ...profileInput, avatarId: 'tuque-rouge' });

		expect(updatePlayer).toHaveBeenCalledWith(
			'me',
			expect.objectContaining({ avatarId: 'tuque-rouge' }),
			{},
			expect.anything()
		);
	});

	it('traduit une réservation perdue en conflit explicite', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		updatePlayer.mockReturnValueOnce({ status: 'avatar-taken' });

		await expect(
			updateOwnProfile(player, { ...profileInput, avatarId: 'tuque-rouge' })
		).rejects.toMatchObject({ code: 'CONFLICT', key: 'error.avatarTaken' });
	});

	it('traduit une identité incompatible avec le poste', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		updatePlayer.mockReturnValueOnce({ status: 'identity-position' });

		await expect(
			updateOwnProfile(player, { ...profileInput, avatarId: 'legende-lafleur' })
		).rejects.toMatchObject({ code: 'VALIDATION', key: 'error.identityWrongPosition' });
	});

	it('traduit un catalogue épuisé sans écrire de valeur nulle', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		updatePlayer.mockReturnValueOnce({ status: 'no-identity' });

		await expect(
			updateOwnProfile(player, { ...profileInput })
		).rejects.toMatchObject({ code: 'CONFLICT', key: 'error.noIdentityAvailable' });
	});

	it('réserve la première identité libre du poste à la création', async () => {
		const { invitePlayer } = await import('./service.ts');
		usage = [{ userId: 'other', avatarId: 'capitaine-navy' }];

		await invitePlayer(admin, {
			firstName: 'Nouvelle',
			lastName: 'Joueuse',
			email: 'nouvelle@example.test',
			position: 'defense',
			age: 28,
			jerseyNumber: null,
			isSubstitute: false
		});

		expect(insertPlayerWithNextAvatar).toHaveBeenCalledWith(
			expect.objectContaining({ position: 'defense' }),
			'defense'
		);
	});

	it('nettoie le compte si la réservation échoue après sa création', async () => {
		const { invitePlayer } = await import('./service.ts');
		insertPlayerWithNextAvatar.mockReturnValueOnce({ status: 'no-identity' });

		await expect(
			invitePlayer(admin, {
				firstName: 'Nouvelle',
				lastName: 'Joueuse',
				email: 'nouvelle@example.test',
				position: 'forward',
				age: 28,
				jerseyNumber: null,
				isSubstitute: false
			})
		).rejects.toMatchObject({ key: 'error.noIdentityAvailable' });
		expect(deleteUser).toHaveBeenCalledWith('new-player');
	});

	it('expose l’avatar courant et les avatars pris dans la fiche', async () => {
		const { getOwnAvatarPicker } = await import('./service.ts');
		usage = [
			{ userId: 'me', avatarId: null },
			{ userId: 'other', avatarId: 'capitaine-navy' }
		];

		const picker = getOwnAvatarPicker(player);
		expect(picker.selected).toBe(resolveAvatarId('me', null));
		expect(picker.taken).toContain('capitaine-navy');
		expect(picker.taken).not.toContain(picker.selected);
	});
});
