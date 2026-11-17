import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../auth/types.ts';
import { resolveAvatarId } from './identity.ts';

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

const updatePlayer = vi.fn((...args: unknown[]) => {
	void args;
	return [] as string[];
});
const insertPlayer = vi.fn((...args: unknown[]) => {
	void args;
});
const findPlayerWithEmail = vi.fn((...args: unknown[]) => {
	void args;
	return row;
});
const createUser = vi.fn(async (...args: unknown[]) => {
	void args;
	return { id: 'new-player' };
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
	insertPlayer: (...args: unknown[]) => insertPlayer(...args),
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
			deleteUser: vi.fn(),
			updateName: vi.fn(async () => undefined),
			setRole: vi.fn(),
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

const player: Actor = { kind: 'user', userId: 'me', name: 'Alex Tremblay', role: 'player' };
const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };

describe('unicité des avatars', () => {
	beforeEach(() => {
		usage = [];
		updatePlayer.mockClear();
		insertPlayer.mockClear();
		findPlayerWithEmail.mockClear();
		createUser.mockClear();
		requestPasswordReset.mockClear();
		regenerateUpcomingGeneratedGames.mockClear();
	});

	it('refuse un avatar porté par un autre joueur actif', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		usage = [
			{ userId: 'me', avatarId: null },
			{ userId: 'other', avatarId: 'tuque-rouge' }
		];

		await expect(
			updateOwnProfile(player, { ...profileInput, avatarId: 'tuque-rouge' })
		).rejects.toMatchObject({ code: 'CONFLICT', key: 'error.avatarTaken' });
		expect(updatePlayer).not.toHaveBeenCalled();
	});

	it('laisse un joueur garder son propre avatar', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		usage = [
			{ userId: 'me', avatarId: 'capitaine-navy' },
			{ userId: 'other', avatarId: 'tuque-rouge' }
		];

		await updateOwnProfile(player, { ...profileInput, avatarId: 'capitaine-navy' });
		expect(updatePlayer).toHaveBeenCalledWith(
			'me',
			expect.objectContaining({ avatarId: 'capitaine-navy' })
		);
	});

	it('refuse un avatar dérivé déjà occupé par une autre fiche sans avatar', async () => {
		const { updateOwnProfile } = await import('./service.ts');
		const taken = resolveAvatarId('other-without-avatar', null);
		usage = [
			{ userId: 'me', avatarId: null },
			{ userId: 'other-without-avatar', avatarId: null }
		];

		await expect(
			updateOwnProfile(player, { ...profileInput, avatarId: taken })
		).rejects.toMatchObject({ code: 'CONFLICT', key: 'error.avatarTaken' });
		expect(updatePlayer).not.toHaveBeenCalled();
	});

	it('applique la même règle à la modification par un admin', async () => {
		const { adminUpdatePlayer } = await import('./service.ts');
		usage = [
			{ userId: 'target', avatarId: null },
			{ userId: 'other', avatarId: 'masque-final' }
		];
		findPlayerWithEmail.mockReturnValue({ ...row, userId: 'target' });

		await expect(
			adminUpdatePlayer(admin, 'target', { avatarId: 'masque-final' })
		).rejects.toMatchObject({ code: 'CONFLICT', key: 'error.avatarTaken' });
		expect(updatePlayer).not.toHaveBeenCalled();
	});

	it('donne le premier avatar libre à une nouvelle fiche', async () => {
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

		expect(insertPlayer).toHaveBeenCalledWith(
			expect.objectContaining({ avatarId: 'barbe-de-brique' })
		);
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
