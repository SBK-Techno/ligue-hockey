import { queueCounts } from '#lib/domain/notifications/service.ts';
import { suppressionCounts } from '#lib/domain/notifications/suppression.ts';

/**
 * Le seul instantané de la file, partagé par `/api/health`, le panneau
 * d'administration et le journal d'un tick. Il ne contient que des compteurs,
 * jamais un destinataire, un sujet ou un corps de message.
 */
export type PushDeliveryCounts = {
	delivered: number;
	failed: number;
};

export type NotificationQueueSnapshot = {
	pending: number;
	failed: number;
	oldestDueAt: number | null;
	suppressed: ReturnType<typeof suppressionCounts>;
	push: PushDeliveryCounts;
};

let lastPushDelivery: PushDeliveryCounts = { delivered: 0, failed: 0 };

export function beginTick(): void {
	lastPushDelivery = { delivered: 0, failed: 0 };
}

export function recordPushDelivery(delivery: PushDeliveryCounts): void {
	lastPushDelivery = {
		delivered: lastPushDelivery.delivered + delivery.delivered,
		failed: lastPushDelivery.failed + delivery.failed
	};
}

export function queueSnapshot(): NotificationQueueSnapshot {
	return {
		...queueCounts(),
		suppressed: suppressionCounts(),
		push: { ...lastPushDelivery }
	};
}
