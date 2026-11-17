import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { throttleMemberAction, isMemberWrite, memberActionExempt } from './member-action.ts';
import { resetThrottle } from './throttle.ts';

const actor: Actor = {
	kind: 'user',
	active: true,
	userId: 'member-1',
	name: 'Membre',
	role: 'player'
};

beforeEach(() => {
	resetThrottle();
	vi.useFakeTimers();
	vi.setSystemTime(Date.UTC(2026, 10, 17, 12, 0, 0));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('limiteur des gestes de membre', () => {
	it('laisse passer la limite puis refuse avec un 429', () => {
		for (let index = 0; index < ABUSE_LIMITS.memberAction.limit; index += 1) {
			throttleMemberAction(actor);
		}

		expect(() => throttleMemberAction(actor)).toThrowError(
			expect.objectContaining({ code: 'RATE_LIMITED', status: 429 })
		);
	});

	it('sépare les membres et se rouvre après la fenêtre', () => {
		for (let index = 0; index < ABUSE_LIMITS.memberAction.limit; index += 1) {
			throttleMemberAction(actor);
		}
		expect(() => throttleMemberAction(actor)).toThrow(AppError);

		throttleMemberAction({ ...actor, userId: 'member-2', name: 'Autre' });

		vi.setSystemTime(
			Date.UTC(2026, 10, 17, 12, 0, 0) + ABUSE_LIMITS.memberAction.windowMs + 1
		);
		expect(() => throttleMemberAction(actor)).not.toThrow();
	});

	it('refuse un acteur sans compte', () => {
		expect(() => throttleMemberAction({ kind: 'anonymous' })).toThrowError(
			expect.objectContaining({ code: 'UNAUTHORIZED' })
		);
	});

	it('compte chaque écriture sauf le plan d’authentification et la santé', () => {
		expect(isMemberWrite('POST', '/discussion')).toBe(true);
		expect(isMemberWrite('PUT', '/profil')).toBe(true);
		expect(isMemberWrite('DELETE', '/api/push/abonnement')).toBe(true);
		expect(isMemberWrite('GET', '/discussion')).toBe(false);
		expect(isMemberWrite('HEAD', '/discussion')).toBe(false);
		expect(isMemberWrite('OPTIONS', '/discussion')).toBe(false);
		expect(memberActionExempt('/api/auth/sign-in/email')).toBe(true);
		expect(memberActionExempt('/deconnexion')).toBe(true);
		expect(memberActionExempt('/api/health')).toBe(true);
		expect(isMemberWrite('POST', '/api/auth/sign-in/email')).toBe(false);
		expect(isMemberWrite('POST', '/api/health')).toBe(false);
	});
});

describe('propriétaire unique du seau', () => {
	it('aucune route ne réserve un second seau', () => {
		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				if (statSync(path).isDirectory()) walk(path);
				else if (path.endsWith('.ts') && readFileSync(path, 'utf8').includes('throttleMemberAction')) {
					offenders.push(path);
				}
			}
		};
		walk(join(process.cwd(), 'src/routes'));
		expect(offenders).toEqual([]);
	});
});
