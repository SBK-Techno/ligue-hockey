import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../auth/types.ts';

const row = {
	userId: 'target',
	firstName: 'Test',
	lastName: 'Player',
	email: 'test@example.com',
	position: 'forward' as const,
	age: 30,
	jerseyNumber: null,
	isSubstitute: false,
	active: true,
	role: 'player' as const
};

const findPlayerWithEmail = vi.fn((...args: [string]) => {
	void args;
	return row;
});
const findPlayer = vi.fn((...args: [string]) => {
	void args;
	return undefined;
});
const deletePlayerAccount = vi.fn();

vi.mock('./queries.ts', () => ({
	findPlayer: (...args: [string]) => findPlayer(...args),
	findPlayerWithEmail: (...args: [string]) => findPlayerWithEmail(...args),
	findPlayersByIds: vi.fn(() => []),
	insertPlayer: vi.fn(),
	listActivePlayers: vi.fn(() => []),
	listAllPlayersWithEmail: vi.fn(() => [row]),
	updatePlayer: vi.fn(),
	deletePlayerAccount: (...args: [string]) => deletePlayerAccount(...args)
}));

vi.mock('#lib/domain/audit/service.ts', () => ({
	recordAudit: vi.fn()
}));

const regenerateUpcomingGeneratedGames = vi.fn();
vi.mock('#lib/domain/games/upcoming.ts', () => ({
	regenerateUpcomingGeneratedGames
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const identitySpy = vi.fn();
vi.mock('./../auth/identity.ts', async (importOriginal) => {
	const original = await importOriginal<typeof import('../auth/identity.ts')>();
	return {
		...original,
		identity: () => ({
			createUser: vi.fn(),
			deleteUser: identitySpy,
			updateName: vi.fn(),
			setRole: vi.fn(),
			requestPasswordReset: vi.fn()
		})
	};
});

const admin: Actor = { kind: 'user', userId: 'admin', name: 'Admin', role: 'admin' };
const manager: Actor = { kind: 'user', userId: 'manager', name: 'Manager', role: 'manager' };

describe('deletePlayer', () => {
	beforeEach(() => {
		findPlayerWithEmail.mockClear();
		findPlayer.mockClear();
		deletePlayerAccount.mockClear();
		identitySpy.mockClear();
		regenerateUpcomingGeneratedGames.mockClear();
	});

	it('uses the transactional account deletion instead of a bare user delete', async () => {
		const { deletePlayer } = await import('./service.ts');
		await deletePlayer(admin, 'target');

		expect(deletePlayerAccount).toHaveBeenCalledWith('target', expect.any(String));
		expect(identitySpy).not.toHaveBeenCalled();
		expect(regenerateUpcomingGeneratedGames).toHaveBeenCalledTimes(1);
	});

	it('refuses to delete the acting account', async () => {
		const { deletePlayer } = await import('./service.ts');
		await expect(deletePlayer(admin, 'admin')).rejects.toMatchObject({ key: 'admin.deleteSelf' });
		expect(deletePlayerAccount).not.toHaveBeenCalled();
	});

	it('refuses to delete an admin account', async () => {
		const { deletePlayer } = await import('./service.ts');
		findPlayerWithEmail.mockReturnValueOnce({ ...row, role: 'admin' } as unknown as typeof row);
		await expect(deletePlayer(admin, 'target')).rejects.toMatchObject({ key: 'admin.deleteAdmin' });
		expect(deletePlayerAccount).not.toHaveBeenCalled();
	});

	it('denies a manager without the player capability', async () => {
		const { deletePlayer } = await import('./service.ts');
		await expect(deletePlayer(manager, 'target')).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(deletePlayerAccount).not.toHaveBeenCalled();
	});
});
