import { describe, expect, it, vi } from 'vitest';
import type { Actor } from './types.ts';

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

const { requirePermission } = await import('./policy.ts');

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
});
