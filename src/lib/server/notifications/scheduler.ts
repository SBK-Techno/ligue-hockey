import { NOTIFICATION_CHANNEL_KEYS, type NotificationChannel } from '#config/notification-channels.ts';
import {
	claimJobs,
	completeJob,
	failJob,
	jobMessage,
	requeueStale,
	retryJob
} from '#lib/domain/notifications/service.ts';
import type { NotificationJobRow } from '#lib/domain/notifications/schema.ts';
import { notifyOverdueBalances } from '#lib/domain/finance/service.ts';
import { env } from '#lib/shared/config/env.ts';
import { logger } from '#lib/shared/logging/logger.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { sendEmail } from './email.ts';
import { HOUR_MS } from '#config/time.ts';
import { sendPush, type PushDeliveryResult } from './push.ts';
import { beginTick, queueSnapshot, recordPushDelivery } from './status.ts';

let timer: ReturnType<typeof setInterval> | null = null;
let running: Promise<void> | null = null;
let lastTickAt: number | null = null;
let lastOverdueScanAt: number | null = null;

export function schedulerHeartbeat(): number | null {
	return lastTickAt;
}

function isChannel(value: string): value is NotificationChannel {
	return (NOTIFICATION_CHANNEL_KEYS as readonly string[]).includes(value);
}

const NO_DELIVERY: PushDeliveryResult = {
	delivered: 0,
	failed: 0,
	lastError: null
};

async function deliver(job: NotificationJobRow): Promise<PushDeliveryResult> {
	const message = jobMessage(job);

	if (!isChannel(job.channel)) {
		throw new Error(`Unknown notification channel: ${job.channel}`);
	}

	switch (job.channel) {
		case 'in_app':
			return NO_DELIVERY;
		case 'email':
			await sendEmail(job.userId, message);
			return NO_DELIVERY;
		case 'push':
			return sendPush(job.userId, message);
	}
}

function retryDelayMs(attempts: number): number {
	return Math.min(HOUR_MS, env.notificationTickMs * Math.max(1, attempts));
}

/**
 * Le balayage des retards coûte deux lectures; il tourne au plus une fois par
 * heure. La clé de dédoublonnage du propriétaire finance rend les appels
 * suivants inoffensifs.
 */
function scanOverdue(now: number): void {
	if (lastOverdueScanAt !== null && now - lastOverdueScanAt < HOUR_MS) return;
	lastOverdueScanAt = now;
	const queued = notifyOverdueBalances();
	if (queued > 0) {
		logger.info('notification.overdue_queued', { count: queued });
	}
}

async function tick(): Promise<void> {
	const now = clock.nowMs();
	lastTickAt = now;
	beginTick();
	const requeued = requeueStale(now - env.notificationClaimTimeoutMs);
	if (requeued > 0) {
		logger.warn('notification.requeued', { count: requeued });
	}

	scanOverdue(now);

	const jobs = claimJobs(now, env.notificationBatchSize);
	for (const job of jobs) {
		try {
			const delivery = await deliver(job);
			if (job.channel === 'push') {
				recordPushDelivery(delivery);
			}
			if (delivery.delivered === 0 && delivery.failed > 0) {
				throw delivery.lastError ?? new Error('Push delivery failed');
			}
			completeJob(job.id);
		} catch (error) {
			if (job.attempts >= env.notificationMaxAttempts) {
				failJob(job.id, error);
				logger.error('notification.failed', {
					jobId: job.id,
					eventKey: job.eventKey,
					channel: job.channel,
					attempts: job.attempts,
					error
				});
			} else {
				const retryAt = clock.nowMs() + retryDelayMs(job.attempts);
				retryJob(job, error, retryAt);
				logger.warn('notification.retry', {
					jobId: job.id,
					eventKey: job.eventKey,
					channel: job.channel,
					attempts: job.attempts,
					retryAt,
					error
				});
			}
		}
	}

	logger.info('notification.queue_snapshot', queueSnapshot());
}

export function runNotificationTick(): Promise<void> {
	running ??= tick().finally(() => {
		running = null;
	});
	return running;
}

export function triggerNotificationTick(): void {
	void runNotificationTick().catch((error) => {
		logger.error('notification.tick_failed', { error });
	});
}

export function startNotificationScheduler(): void {
	if (timer) return;
	timer = setInterval(() => {
		triggerNotificationTick();
	}, env.notificationTickMs);
	timer.unref();
	triggerNotificationTick();
	logger.info('notification.scheduler_started', {
		tickMs: env.notificationTickMs
	});
}

export function stopNotificationScheduler(): void {
	if (!timer) return;
	clearInterval(timer);
	timer = null;
	logger.info('notification.scheduler_stopped');
}
