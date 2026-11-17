import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSubscriptionRow } from '#lib/domain/notifications/schema.ts';

const state = vi.hoisted(() => ({
	subscriptions: [] as PushSubscriptionRow[],
	deleted: [] as string[],
	sendNotification: vi.fn(),
	log: vi.fn(),
	WebPushError: class extends Error {
		statusCode: number;
		constructor(statusCode: number) {
			super('push error');
			this.statusCode = statusCode;
		}
	}
}));

vi.mock('#lib/domain/notifications/queries.ts', () => ({
	listPushSubscriptionsForUser: () => state.subscriptions,
	deletePushSubscription: (endpoint: string) => {
		state.deleted.push(endpoint);
	}
}));

vi.mock('#lib/shared/config/env.ts', () => ({
	env: {
		vapid: {
			subject: 'mailto:test@example.test',
			publicKey: 'public-key',
			privateKey: 'private-key'
		}
	}
}));

vi.mock('web-push', () => ({
	setVapidDetails: vi.fn(),
	sendNotification: state.sendNotification,
	WebPushError: state.WebPushError
}));

vi.mock('#lib/shared/logging/logger.ts', () => ({
	logger: {
		info: state.log,
		warn: state.log,
		error: state.log,
		debug: state.log
	}
}));

const { sendPush } = await import('./push.ts');

function subscription(endpoint: string): PushSubscriptionRow {
	return {
		id: endpoint,
		userId: 'player',
		endpoint,
		p256dh: 'p256dh',
		auth: 'auth',
		userAgent: null,
		createdAt: 0,
		lastUsedAt: 0,
		failureCount: 0
	};
}

const message = {
	title: 'Titre',
	body: 'Corps',
	url: '/matchs/1',
	tag: 'game',
	email: {
		heading: 'Titre',
		paragraphs: ['Corps'],
		actionLabel: 'Ouvrir',
		actionUrl: '/matchs/1'
	}
};

beforeEach(() => {
	state.subscriptions = [subscription('one'), subscription('two')];
	state.deleted = [];
	state.sendNotification.mockReset();
	state.log.mockReset();
});

describe('livraison push', () => {
	it('rapporte un succès et un échec sans les confondre', async () => {
		state.sendNotification
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('abonnement cassé'));

		const result = await sendPush('player', message);

		expect(result).toMatchObject({ delivered: 1, failed: 1 });
		expect(result.lastError).toBeInstanceOf(Error);
		expect(state.log).toHaveBeenCalledWith(
			'push.partial_failure',
			expect.objectContaining({ delivered: 1, failed: 1 })
		);
		expect(state.log).not.toHaveBeenCalledWith('push.sent', expect.anything());
	});

	it('nomme l’échec total et conserve la dernière erreur', async () => {
		state.sendNotification
			.mockRejectedValueOnce(new Error('premier'))
			.mockRejectedValueOnce(new Error('second'));

		const result = await sendPush('player', message);

		expect(result).toMatchObject({ delivered: 0, failed: 2 });
		expect((result.lastError as Error).message).toBe('second');
		expect(state.log).toHaveBeenCalledWith(
			'push.failed',
			expect.objectContaining({ delivered: 0, failed: 2 })
		);
	});

	it('retire un abonnement disparu sans le compter comme un échec', async () => {
		state.sendNotification.mockRejectedValue(new state.WebPushError(410));

		const result = await sendPush('player', message);

		expect(result).toMatchObject({ delivered: 0, failed: 0 });
		expect(state.deleted).toEqual(['one', 'two']);
		expect(state.log).toHaveBeenCalledWith(
			'push.subscription_removed',
			expect.objectContaining({ statusCode: 410 })
		);
	});
});
