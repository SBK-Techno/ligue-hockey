import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES } from '#config/capabilities.ts';
import { mobileSurfaces, primarySurfaces } from './surfaces.ts';
import {
	can,
	canAny,
	canCreatePoll,
	canEditProfile,
	canManageGame,
	canModerateChat,
	canViewBalance,
	capabilitiesOf,
	requireAdmin,
	requirePermission,
	requireUser
} from './policy.ts';
import { actorFromUser, type Actor, type UserActor } from './types.ts';

function actor(role: UserActor['role']): UserActor {
	return { kind: 'user', active: true, userId: 'user-1', name: 'Test', role };
}

const anonymous: Actor = { kind: 'anonymous' };

const forgedInactive: UserActor = {
	kind: 'user',
	userId: 'user-1',
	name: 'Test',
	role: 'admin',
	active: false
};

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

	it('turns a deactivated account into an anonymous actor', () => {
		const inactive = actorFromUser({
			id: 'user-1',
			name: 'Test',
			role: 'manager',
			active: false
		});

		expect(inactive.kind).toBe('anonymous');
		expect(capabilitiesOf(inactive)).toEqual([]);
		expect(can(inactive, 'manageGames')).toBe(false);
		expect(() => requireUser(inactive)).toThrow();
	});

	it('refuses a forged inactive user actor even when it keeps its role', () => {
		expect(capabilitiesOf(forgedInactive)).toEqual([]);
		expect(can(forgedInactive, 'managePlayers')).toBe(false);
		expect(() => requireUser(forgedInactive)).toThrow();
	});

	it.each(ALL_CAPABILITIES)('refuses %s to a forged inactive actor', (capability) => {
		expect(can(forgedInactive, capability)).toBe(false);
		expect(() => requirePermission(forgedInactive, capability)).toThrow();
	});

	it('refuses every helper and requirement to a forged inactive actor', () => {
		expect(capabilitiesOf(forgedInactive)).toEqual([]);
		expect(canAny(forgedInactive, ALL_CAPABILITIES)).toBe(false);
		expect(canViewBalance(forgedInactive, forgedInactive.userId)).toBe(false);
		expect(canEditProfile(forgedInactive, forgedInactive.userId)).toBe(false);
		expect(canCreatePoll(forgedInactive, true)).toBe(false);
		expect(canManageGame(forgedInactive)).toBe(false);
		expect(canModerateChat(forgedInactive)).toBe(false);
		expect(() => requirePermission(forgedInactive, 'manageGames')).toThrow();
		expect(() => requireAdmin(forgedInactive)).toThrow();
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

	it('gives the substitute bank a short label for the five-slot mobile bar', () => {
		const subs = primarySurfaces(actor('player')).find((surface) => surface.key === 'subs');
		expect(subs?.shortLabelKey).toBe('subs.short');
		expect(subs?.labelKey).toBe('subs.title');
	});
});
