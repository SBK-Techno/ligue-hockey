import { describe, expect, it } from 'vitest';
import { mobileSurfaces, primarySurfaces } from './surfaces.ts';
import { can, capabilitiesOf } from './policy.ts';
import type { Actor, UserActor } from './types.ts';

function actor(role: UserActor['role']): UserActor {
	return { kind: 'user', userId: 'user-1', name: 'Test', role };
}

const anonymous: Actor = { kind: 'anonymous' };

describe('capability policy', () => {
	it('gives every member the base capabilities', () => {
		expect(capabilitiesOf(actor('player'))).toEqual([
			'member',
			'manageOwnAvailability',
			'claimSubs'
		]);
		expect(can(actor('player'), 'member')).toBe(true);
		expect(can(actor('player'), 'claimSubs')).toBe(true);
	});

	it('keeps account and settings management for admins', () => {
		expect(can(actor('player'), 'managePlayers')).toBe(false);
		expect(can(actor('manager'), 'managePlayers')).toBe(false);
		expect(can(actor('manager'), 'manageSettings')).toBe(false);
		expect(can(actor('admin'), 'managePlayers')).toBe(true);
		expect(can(actor('admin'), 'manageSettings')).toBe(true);
	});

	it('lets a manager run the league without owning accounts', () => {
		expect(can(actor('manager'), 'manageGames')).toBe(true);
		expect(can(actor('manager'), 'manageSubs')).toBe(true);
		expect(can(actor('manager'), 'moderateChat')).toBe(true);
		expect(can(actor('manager'), 'viewAdmin')).toBe(true);
		expect(can(actor('manager'), 'recordPayments')).toBe(false);
		expect(can(actor('manager'), 'viewAllBalances')).toBe(false);
	});

	it('denies every capability to an anonymous actor', () => {
		expect(capabilitiesOf(anonymous)).toEqual([]);
		expect(can(anonymous, 'member')).toBe(false);
		expect(can(anonymous, 'manageGames')).toBe(false);
	});

	it('declares a manager role with its own label', () => {
		expect(actor('manager').role).toBe('manager');
	});
});

describe('role surfaces', () => {
	it('keeps the player navigation to member destinations', () => {
		const keys = primarySurfaces(actor('player')).map((surface) => surface.key);
		expect(keys).toEqual(['home', 'games', 'subs', 'chat', 'account']);
		expect(mobileSurfaces(actor('player')).map((surface) => surface.key)).toEqual([
			'home',
			'games',
			'subs',
			'chat',
			'account'
		]);
	});

	it('puts management in the manager navigation and the fifth mobile slot', () => {
		const keys = primarySurfaces(actor('manager')).map((surface) => surface.key);
		expect(keys).toContain('management');
		expect(mobileSurfaces(actor('manager')).map((surface) => surface.key)).toEqual([
			'home',
			'games',
			'subs',
			'chat',
			'management'
		]);
	});

	it('keeps the substitute bank reachable for a manager', () => {
		const keys = primarySurfaces(actor('manager')).map((surface) => surface.key);
		expect(keys).toContain('subs');
	});
});
