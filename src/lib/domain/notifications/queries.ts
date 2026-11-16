import { and, asc, desc, eq, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import {
	notificationJobs,
	notificationPreferences,
	pushSubscriptions,
	type NotificationJobRow
} from './schema.ts';

export type NewJob = typeof notificationJobs.$inferInsert;

export function insertJobs(jobs: readonly NewJob[]): number {
	if (jobs.length === 0) return 0;

	let inserted = 0;
	db.transaction((tx) => {
		for (const job of jobs) {
			const result = tx
				.insert(notificationJobs)
				.values(job)
				.onConflictDoNothing({ target: notificationJobs.dedupeKey })
				.run();
			inserted += result.changes;
		}
	});
	return inserted;
}

export function findPreferences(playerId: string) {
	return db
		.select()
		.from(notificationPreferences)
		.where(eq(notificationPreferences.playerId, playerId))
		.get();
}

export function upsertPreferences(input: {
	playerId: string;
	emailEnabled: boolean;
	pushEnabled: boolean;
	updatedAt: number;
}): void {
	db.insert(notificationPreferences)
		.values(input)
		.onConflictDoUpdate({
			target: notificationPreferences.playerId,
			set: {
				emailEnabled: input.emailEnabled,
				pushEnabled: input.pushEnabled,
				updatedAt: input.updatedAt
			}
		})
		.run();
}

export function upsertPushSubscription(input: {
	id: string;
	userId: string;
	endpoint: string;
	p256dh: string;
	auth: string;
	userAgent: string | null;
	createdAt: number;
}): void {
	db.insert(pushSubscriptions)
		.values({ ...input, lastUsedAt: input.createdAt })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: {
				userId: input.userId,
				p256dh: input.p256dh,
				auth: input.auth,
				userAgent: input.userAgent,
				lastUsedAt: input.createdAt
			}
		})
		.run();
}

export function deletePushSubscriptionForUser(
	userId: string,
	endpoint: string
): void {
	db.delete(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.userId, userId),
				eq(pushSubscriptions.endpoint, endpoint)
			)
		)
		.run();
}

export function listPreferences(userIds: readonly string[]) {
	if (userIds.length === 0) return [];
	return db
		.select()
		.from(notificationPreferences)
		.where(inArray(notificationPreferences.playerId, [...userIds]))
		.all();
}

export function listPushSubscriberIds(userIds: readonly string[]): string[] {
	if (userIds.length === 0) return [];
	return db
		.selectDistinct({ userId: pushSubscriptions.userId })
		.from(pushSubscriptions)
		.where(inArray(pushSubscriptions.userId, [...userIds]))
		.all()
		.map((row) => row.userId);
}

export function listUserEmails(
	userIds: readonly string[]
): { id: string; email: string }[] {
	if (userIds.length === 0) return [];
	return db
		.select({ id: user.id, email: user.email })
		.from(user)
		.where(inArray(user.id, [...userIds]))
		.all();
}

export function claimDueJobs(now: number, limit: number): NotificationJobRow[] {
	const due = db
		.select({ id: notificationJobs.id })
		.from(notificationJobs)
		.where(
			and(
				eq(notificationJobs.status, 'pending'),
				lte(notificationJobs.scheduledFor, now)
			)
		)
		.orderBy(asc(notificationJobs.scheduledFor))
		.limit(limit)
		.all();

	if (due.length === 0) return [];

	return db
		.update(notificationJobs)
		.set({
			status: 'sending',
			claimedAt: now,
			attempts: sql`${notificationJobs.attempts} + 1`
		})
		.where(
			and(
				inArray(
					notificationJobs.id,
					due.map((row) => row.id)
				),
				eq(notificationJobs.status, 'pending')
			)
		)
		.returning()
		.all();
}

export function requeueStaleSending(cutoff: number): number {
	const result = db
		.update(notificationJobs)
		.set({ status: 'pending', claimedAt: null })
		.where(
			and(
				eq(notificationJobs.status, 'sending'),
				lt(notificationJobs.claimedAt, cutoff)
			)
		)
		.run();
	return result.changes;
}

export function markSent(id: string, sentAt: number): void {
	db.update(notificationJobs)
		.set({
			status: 'sent',
			sentAt,
			claimedAt: null,
			lastError: null
		})
		.where(eq(notificationJobs.id, id))
		.run();
}

export function markFailed(id: string, lastError: string): void {
	db.update(notificationJobs)
		.set({
			status: 'failed',
			claimedAt: null,
			lastError: lastError.slice(0, 500)
		})
		.where(eq(notificationJobs.id, id))
		.run();
}

export function reschedule(id: string, scheduledFor: number, lastError: string): void {
	db.update(notificationJobs)
		.set({
			status: 'pending',
			scheduledFor,
			claimedAt: null,
			lastError: lastError.slice(0, 500)
		})
		.where(eq(notificationJobs.id, id))
		.run();
}

export function listInAppJobs(
	userId: string,
	limit: number,
	before: number | null
): NotificationJobRow[] {
	const conditions = [
		eq(notificationJobs.userId, userId),
		eq(notificationJobs.channel, 'in_app'),
		eq(notificationJobs.status, 'sent')
	];
	if (before !== null) {
		conditions.push(lt(notificationJobs.createdAt, before));
	}

	return db
		.select()
		.from(notificationJobs)
		.where(and(...conditions))
		.orderBy(desc(notificationJobs.createdAt))
		.limit(limit)
		.all();
}

export function findInAppJob(
	userId: string,
	id: string
): NotificationJobRow | undefined {
	return db
		.select()
		.from(notificationJobs)
		.where(
			and(
				eq(notificationJobs.userId, userId),
				eq(notificationJobs.channel, 'in_app'),
				eq(notificationJobs.status, 'sent'),
				eq(notificationJobs.id, id)
			)
		)
		.get();
}

export function countUnread(userId: string): number {
	const row = db
		.select({ count: sql<number>`count(*)` })
		.from(notificationJobs)
		.where(
			and(
				eq(notificationJobs.userId, userId),
				eq(notificationJobs.channel, 'in_app'),
				eq(notificationJobs.status, 'sent'),
				isNull(notificationJobs.readAt)
			)
		)
		.get();
	return row?.count ?? 0;
}

export function markJobsRead(
	userId: string,
	ids: readonly string[],
	readAt: number
): number {
	if (ids.length === 0) return 0;
	const result = db
		.update(notificationJobs)
		.set({ readAt })
		.where(
			and(
				eq(notificationJobs.userId, userId),
				eq(notificationJobs.channel, 'in_app'),
				inArray(notificationJobs.id, [...ids]),
				isNull(notificationJobs.readAt)
			)
		)
		.run();
	return result.changes;
}

export function listPushSubscriptionsForUser(userId: string) {
	return db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.all();
}

export function deletePushSubscription(endpoint: string): void {
	db.delete(pushSubscriptions)
		.where(eq(pushSubscriptions.endpoint, endpoint))
		.run();
}
