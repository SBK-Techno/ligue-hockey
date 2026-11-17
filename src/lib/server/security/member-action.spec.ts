import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { AppError } from '#lib/shared/errors.ts';
import { throttleMemberAction } from './member-action.ts';
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
});
