import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { resetThrottle } from '#lib/server/security/throttle.ts';

vi.mock('./service.ts', () => ({ getPlayer: vi.fn() }));
vi.mock('#lib/domain/ratings/service.ts', () => ({ getRatings: vi.fn() }));
vi.mock('#lib/domain/gamesheet/season-stats.ts', () => ({
	seasonStatsFor: vi.fn()
}));

const { assertPeekAllowed, peekCacheControl, peekScope } = await import('./peek.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player-1',
	name: 'Joueur',
	role: 'player'
};
const admin: Actor = { ...player, userId: 'admin-1', role: 'admin' };

beforeEach(() => {
	resetThrottle();
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('cache de la fiche de joueur', () => {
	it('ne met jamais en cache une fiche qui contient les notes', () => {
		expect(peekCacheControl(admin)).toBe('no-store');
	});

	it('garde une fiche privée et courte sans notes', () => {
		expect(peekCacheControl(player)).toBe('private, max-age=15');
		expect(peekCacheControl({ kind: 'anonymous' })).toBe('private, max-age=15');
	});

	it('donne une portée différente au lecteur qui voit les notes', () => {
		expect(peekScope(admin)).toBe('ratings');
		expect(peekScope(player)).toBe('public');
		expect(peekScope({ kind: 'anonymous' })).toBe('public');
	});
});

describe('limiteur de fiches', () => {
	it('refuse après la limite, par acteur', () => {
		for (let index = 0; index < ABUSE_LIMITS.peek.limit; index += 1) {
			assertPeekAllowed(player);
		}

		expect(() => assertPeekAllowed(player)).toThrowError(
			expect.objectContaining({ code: 'RATE_LIMITED', status: 429 })
		);
		expect(() => assertPeekAllowed(admin)).not.toThrow();
	});

	it('se rouvre après la fenêtre', () => {
		for (let index = 0; index < ABUSE_LIMITS.peek.limit; index += 1) {
			assertPeekAllowed(player);
		}
		vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0) + ABUSE_LIMITS.peek.windowMs + 1);
		expect(() => assertPeekAllowed(player)).not.toThrow();
	});
});
