import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ABUSE_LIMITS } from '#config/abuse.ts';
import type { Actor } from '#lib/domain/auth/types.ts';

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

const { sqlite } = await import('#lib/server/db/index.ts');
const {
	listInboxPage,
	listFailedJobs,
	markAllInboxRead,
	notify,
	queueCounts,
	retryFailedJob,
	subscribeToPush,
	unreadCount
} = await import('./service.ts');
const {
	beginTick,
	queueSnapshot,
	recordPushDelivery
} = await import('#lib/server/notifications/status.ts');
const { recordSuppression, suppressionCounts } = await import('./suppression.ts');
const { decodeCursor } = await import('#lib/shared/paging/cursor.ts');

const admin: Actor = {
	kind: 'user',
	active: true,
	userId: 'admin',
	name: 'Admin',
	role: 'admin'
};
const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const PAYLOAD = JSON.stringify({
	gameId: 'game_test',
	gameDate: '2026-11-22',
	startTime: '09:00',
	location: 'Aréna de test'
});

let sequence = 0;

function insertJob(input: {
	userId?: string;
	status?: 'pending' | 'sent' | 'failed';
	scheduledFor?: number;
	createdAt?: number;
	readAt?: number | null;
}): string {
	sequence += 1;
	const id = `job_${sequence}`;
	sqlite
		.prepare(
			`insert into notification_jobs
			 (id, event_key, user_id, channel, scheduled_for, status, payload_json, dedupe_key, attempts, last_error, created_at, sent_at, claimed_at, read_at)
			 values (?, 'game_cancelled', ?, 'in_app', ?, ?, ?, ?, 0, null, ?, ?, null, ?)`
		)
		.run(
			id,
			input.userId ?? 'player',
			input.scheduledFor ?? 100,
			input.status ?? 'sent',
			PAYLOAD,
			id,
			input.createdAt ?? 100,
			input.status === 'sent' || input.status === undefined ? 100 : null,
			input.readAt ?? null
		);
	return id;
}

function auditCount(): number {
	const row = sqlite
		.prepare("select count(*) as count from audit_log where action = 'notification.retry'")
		.get() as { count: number };
	return row.count;
}

beforeEach(() => {
	sqlite.prepare('delete from notification_jobs').run();
	sqlite.prepare('delete from audit_log').run();
	sqlite.prepare('delete from notification_preferences').run();
	sqlite.prepare('delete from push_subscriptions').run();
	sqlite.prepare('delete from players').run();
	sqlite.prepare('delete from user').run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('admin', 'Admin', 'admin@example.test', 1, 0, 0, 'admin')`
		)
		.run();
	sqlite
		.prepare(
			`insert into user (id, name, email, email_verified, created_at, updated_at, role)
			 values ('player', 'Joueur', 'player@example.test', 1, 0, 0, 'player')`
		)
		.run();
});

describe('pagination de la boîte', () => {
	it('atteint la page suivante sans doublon ni trou', () => {
		for (let index = 0; index < 52; index += 1) {
			insertJob({ createdAt: 1000 + index });
		}
		// Trois avis partagent la même milliseconde : l'identifiant départage.
		for (let index = 0; index < 3; index += 1) {
			insertJob({ createdAt: 2000 });
		}

		const first = listInboxPage(player, null);
		expect(first.items).toHaveLength(50);
		expect(first.nextCursor).not.toBeNull();
		expect(auditCount()).toBe(0);

		const cursor = decodeCursor(first.nextCursor);
		expect(cursor).not.toBeNull();
		const second = listInboxPage(player, cursor);
		expect(second.nextCursor).toBeNull();
		expect(second.items).toHaveLength(5);

		const ids = new Set([...first.items, ...second.items].map((item) => item.id));
		expect(ids.size).toBe(55);
		expect(
			second.items.every((item) => !first.items.some((older) => older.id === item.id))
		).toBe(true);
	});
});

describe('tout marquer comme lu', () => {
	it('efface les avis au-delà de la page affichée', () => {
		for (let index = 0; index < 55; index += 1) {
			insertJob({ createdAt: 1000 + index });
		}
		expect(unreadCount(player)).toBe(55);

		expect(markAllInboxRead(player)).toBe(55);
		expect(unreadCount(player)).toBe(0);
		expect(markAllInboxRead(player)).toBe(0);
	});
});

describe('file et relance', () => {
	it('compte les travaux en attente, les échecs et la plus ancienne échéance', () => {
		insertJob({ status: 'pending', scheduledFor: 500 });
		insertJob({ status: 'pending', scheduledFor: 300 });
		insertJob({ status: 'failed', scheduledFor: 200 });

		expect(queueCounts()).toEqual({ pending: 2, failed: 1, oldestDueAt: 300 });
	});

	it('montre un échec à un opérateur et le relance avec une trace', () => {
		const failedId = insertJob({ status: 'failed', scheduledFor: 200 });

		expect(() => listFailedJobs(player)).toThrow();
		const failed = listFailedJobs(admin);
		expect(failed).toHaveLength(1);
		expect(failed[0]).toEqual(
			expect.objectContaining({ id: failedId, eventKey: 'game_cancelled', attempts: 0 })
		);
		expect(Object.hasOwn(failed[0], 'payloadJson')).toBe(false);

		expect(() => retryFailedJob(player, failedId)).toThrow();
		expect(auditCount()).toBe(0);

		retryFailedJob(admin, failedId);
		const row = sqlite
			.prepare('select status, attempts from notification_jobs where id = ?')
			.get(failedId) as { status: string; attempts: number };
		expect(row).toEqual({ status: 'pending', attempts: 0 });
		expect(auditCount()).toBe(1);

		expect(() => retryFailedJob(admin, failedId)).toThrow();
		expect(auditCount()).toBe(1);
	});

	it('compose l’instantané sans destinataire ni contenu', () => {
		insertJob({ status: 'pending', scheduledFor: 300 });
		insertJob({ status: 'failed', scheduledFor: 200 });
		recordSuppression('channel_disabled');
		beginTick();
		recordPushDelivery({ delivered: 1, failed: 1 });

		const snapshot = queueSnapshot();
		expect(snapshot).toMatchObject({
			pending: 1,
			failed: 1,
			oldestDueAt: 300,
			push: { delivered: 1, failed: 1 }
		});
		expect(snapshot.suppressed.channel_disabled).toBe(
			suppressionCounts().channel_disabled
		);
		expect(JSON.stringify(snapshot)).not.toContain('@example.test');
		expect(JSON.stringify(snapshot)).not.toContain('Aréna');
	});

	it('borne les appareils push d’un même membre', () => {
		const limit = ABUSE_LIMITS.pushSubscription.limit;
		const subscribe = (endpoint: string) =>
			subscribeToPush(player, {
				endpoint,
				keys: { p256dh: 'cle-publique', auth: 'secret' }
			});

		for (let index = 0; index < limit; index += 1) {
			subscribe(`https://fcm.googleapis.com/push/${index}`);
		}
		// Un appareil déjà enregistré se met à jour même au plafond.
		expect(() => subscribe('https://fcm.googleapis.com/push/0')).not.toThrow();
		expect(() => subscribe('https://fcm.googleapis.com/push/extra')).toThrowError(
			expect.objectContaining({ code: 'RATE_LIMITED', key: 'profile.pushFailed' })
		);
		expect(
			sqlite
				.prepare("select count(*) as count from push_subscriptions where user_id = 'player'")
				.get()
		).toEqual({ count: limit });
	});

	it('garde le premier propriétaire d’un point de terminaison', () => {
		const endpoint = 'https://fcm.googleapis.com/push/shared';
		subscribeToPush(player, {
			endpoint,
			keys: { p256dh: 'premier', auth: 'secret-1' }
		});

		expect(() =>
			subscribeToPush(admin, {
				endpoint,
				keys: { p256dh: 'second', auth: 'secret-2' }
			})
		).toThrowError(expect.objectContaining({ code: 'CONFLICT' }));

		expect(
			sqlite
				.prepare('select user_id, p256dh from push_subscriptions where endpoint = ?')
				.get(endpoint)
		).toEqual({ user_id: 'player', p256dh: 'premier' });

		// Le propriétaire peut rafraîchir ses propres clés.
		subscribeToPush(player, {
			endpoint,
			keys: { p256dh: 'rafraichi', auth: 'secret-3' }
		});
		expect(
			sqlite
				.prepare('select p256dh from push_subscriptions where endpoint = ?')
				.get(endpoint)
		).toEqual({ p256dh: 'rafraichi' });

		// Le premier propriétaire reçoit toujours ses avis push.
		notify(
			'game_cancelled',
			[{ userId: 'player' }],
			{
				gameId: 'game_test',
				gameDate: '2026-11-22',
				startTime: '09:00',
				location: 'Aréna de test'
			},
			{ dedupeKey: 'push-owner-test' }
		);
		expect(
			sqlite
				.prepare(
					"select user_id from notification_jobs where channel = 'push' and event_key = 'game_cancelled'"
				)
				.all()
		).toEqual([{ user_id: 'player' }]);
	});
});
