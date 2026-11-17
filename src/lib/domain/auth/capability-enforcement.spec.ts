import { describe, expect, it, vi } from 'vitest';
import type { Actor } from './types.ts';

vi.mock('#lib/server/db/index.ts', async () => {
	const Database = (await import('better-sqlite3')).default;
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite);
	migrate(db, { migrationsFolder: 'drizzle' });
	return { db, sqlite };
});

vi.mock('#config/roles.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('#config/roles.ts')>();
	return {
		...actual,
		roleHasCapability: (role: Parameters<typeof actual.roleHasCapability>[0], capability: Parameters<typeof actual.roleHasCapability>[1]) => {
			if (capability === 'manageOwnAvailability' || capability === 'claimSubs') {
				return false;
			}
			return actual.roleHasCapability(role, capability);
		}
	};
});

const { sqlite } = await import('#lib/server/db/index.ts');
const { requirePermission } = await import('./policy.ts');
const { markAvailability } = await import('#lib/domain/availability/service.ts');
const { claimSubstitute } = await import('#lib/domain/subs/service.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

describe('capacités de membre déclarées', () => {
	it.each(['manageOwnAvailability', 'claimSubs'] as const)(
		'refuse %s quand la table la retire',
		(capability) => {
			expect(() => requirePermission(player, capability)).toThrowError(
				expect.objectContaining({ code: 'FORBIDDEN', status: 403 })
			);
		}
	);

	it('laisse passer une capacité non retirée', () => {
		expect(() => requirePermission(player, 'member')).not.toThrow();
	});

	it('refuse la présence sans écrire de ligne', () => {
		expect(() => markAvailability(player, 'game-1', 'present')).toThrowError(
			expect.objectContaining({ code: 'FORBIDDEN', status: 403 })
		);
		expect(
			sqlite.prepare('select count(*) as count from game_availability').get()
		).toEqual({ count: 0 });
	});

	it('refuse une réclamation sans fermer la demande', () => {
		expect(() =>
			claimSubstitute(
				player,
				{ id: 'game-1' } as never,
				'request-1'
			)
		).toThrowError(expect.objectContaining({ code: 'FORBIDDEN', status: 403 }));
		const request = sqlite
			.prepare("select count(*) as count from sub_requests where status = 'filled'")
			.get();
		expect(request).toEqual({ count: 0 });
	});
});
