import { CURRENCY, type Currency } from '#config/currency.ts';
import { branding } from '#lib/generated/branding.ts';
import {
	canViewBalance,
	requirePermission,
	requireUser
} from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import {
	findOwnProfile,
	getPlayer,
	listActivePlayerIds,
	listAdminPlayers
} from '#lib/domain/players/service.ts';
import { notify } from '#lib/domain/notifications/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { db } from '#lib/server/db/index.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { overdueNotices } from './overdue.ts';

import { applyDiscount, splitPlan } from './plan.ts';
import { computeBalance, planIsActive, type Balance, type Payment, type PaymentPlan } from './policy.ts';
import {
	deletePayment,
	findPayment,
	findPlan,
	insertPayment,
	listAllPayments,
	listPayments,
	listPlans,
	upsertPlan
} from './queries.ts';
import type { PaymentPlanRow, PaymentRow } from './schema.ts';
import {
	paymentInputSchema,
	paymentPlanInputSchema,
	type PaymentInput,
	type PaymentPlanInput
} from './validators.ts';

export type BalanceView = Balance & {
	playerId: string;
	currency: Currency;
	playerName: string;
	/** Un plan à zéro n'ouvre ni formulaire de paiement ni solde à payer. */
	planActive: boolean;
};

export type AdminBalanceRow = BalanceView & {
	active: boolean;
	hasPlan: boolean;
};

function today(): string {
	return todayInZone(branding.timezone);
}

function graceDays(): number {
	return getSettings()['finance.overdueGraceDays'];
}

function planFromRow(row: PaymentPlanRow | undefined): PaymentPlan | null {
	if (!row) return null;
	const settings = getSettings();
	return {
		totalCents: row.totalCents,
		firstCents: row.firstCents,
		secondCents: row.secondCents,
		// Un plan plus ancien peut ne pas porter les dates de la saison : on
		// reprend alors les dates prévues dans les réglages.
		firstDueDate: row.firstDueDate ?? settings['finance.installment1Due'],
		secondDueDate: row.secondDueDate ?? settings['finance.installment2Due']
	};
}

function paymentsFromRows(rows: readonly PaymentRow[]): Payment[] {
	return rows.map((row) => ({
		amountCents: row.amountCents,
		paidAt: row.paidAt
	}));
}

function balanceFor(
	playerId: string,
	playerName: string,
	plan: PaymentPlan | null,
	payments: readonly Payment[]
): BalanceView | null {
	if (!plan) return null;
	return {
		playerId,
		playerName,
		currency: CURRENCY,
		planActive: planIsActive(plan),
		...(computeBalance(plan, payments, today(), graceDays()) as Balance)
	};
}

function emptyBalance(playerId: string, playerName: string): BalanceView {
	return {
		playerId,
		playerName,
		currency: CURRENCY,
		planActive: false,
		status: 'upcoming',
		totalCents: 0,
		paidCents: 0,
		outstandingCents: 0,
		overdueCents: 0,
		isOverdue: false,
		installments: [
			{
				number: 1,
				amountCents: 0,
				paidCents: 0,
				remainingCents: 0,
				dueDate: null,
				paidAt: null,
				status: 'upcoming'
			},
			{
				number: 2,
				amountCents: 0,
				paidCents: 0,
				remainingCents: 0,
				dueDate: null,
				paidAt: null,
				status: 'upcoming'
			}
		]
	};
}

export type PaymentView = {
	id: string;
	amountCents: number;
	paidAt: string;
	method: PaymentRow['method'];
	note: string | null;
};

export function listMyPayments(actor: Actor): PaymentView[] {
	const user = requireUser(actor);
	return listPayments(user.userId).map((payment) => ({
		id: payment.id,
		amountCents: payment.amountCents,
		paidAt: payment.paidAt,
		method: payment.method,
		note: payment.note
	}));
}

export function getMyBalance(actor: Actor): BalanceView | null {
	const user = requireUser(actor);
	const player = findOwnProfile(actor);
	if (!player) return null;
	const plan = planFromRow(findPlan(user.userId));
	return balanceFor(
		user.userId,
		player.fullName,
		plan,
		paymentsFromRows(listPayments(user.userId))
	);
}

export function listPlayerPayments(actor: Actor, playerId: string): PaymentView[] {
	requirePermission(actor, 'viewAllBalances');
	getPlayer(actor, playerId);
	return listPayments(playerId).map((payment) => ({
		id: payment.id,
		amountCents: payment.amountCents,
		paidAt: payment.paidAt,
		method: payment.method,
		note: payment.note
	}));
}

export function getPlayerBalance(actor: Actor, playerId: string): BalanceView | null {
	if (!canViewBalance(actor, playerId)) {
		throw new AppError('FORBIDDEN');
	}
	const player = getPlayer(actor, playerId);
	if (!('fullName' in player)) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	const plan = planFromRow(findPlan(playerId));
	return balanceFor(
		playerId,
		player.fullName,
		plan,
		paymentsFromRows(listPayments(playerId))
	);
}

export function listBalances(actor: Actor): AdminBalanceRow[] {
	requirePermission(actor, 'viewAllBalances');
	const plans = new Map(listPlans().map((plan) => [plan.playerId, plan]));
	const payments = new Map<string, PaymentRow[]>();
	for (const payment of listAllPayments()) {
		const rows = payments.get(payment.playerId) ?? [];
		rows.push(payment);
		payments.set(payment.playerId, rows);
	}

	return listAdminPlayers(actor).map((player) => {
		const plan = planFromRow(plans.get(player.userId));
		const view = balanceFor(
			player.userId,
			player.fullName,
			plan,
			paymentsFromRows(payments.get(player.userId) ?? [])
		);
		return {
			...(view ?? emptyBalance(player.userId, player.fullName)),
			active: player.active,
			hasPlan: planIsActive(plan)
		};
	});
}

/**
 * Signale une seule fois chaque versement en retard. Le balayage est appelé
 * par la tâche planifiée des notifications; la clé de dédoublonnage est
 * `balance_overdue:<joueur>:<versement>:<échéance>`, donc un tick suivant ne
 * crée aucun doublon et un nouveau plan produit un nouvel avis.
 */
export function notifyOverdueBalances(): number {
	const active = new Set(listActivePlayerIds());
	const payments = new Map<string, PaymentRow[]>();
	for (const payment of listAllPayments()) {
		const rows = payments.get(payment.playerId) ?? [];
		rows.push(payment);
		payments.set(payment.playerId, rows);
	}

	const candidates = listPlans()
		.filter((plan) => active.has(plan.playerId))
		.map((plan) => ({
			playerId: plan.playerId,
			plan: planFromRow(plan),
			payments: paymentsFromRows(payments.get(plan.playerId) ?? [])
		}));

	let created = 0;
	for (const notice of overdueNotices(candidates, today(), graceDays())) {
		created += notify(
			'balance_overdue',
			[{ userId: notice.playerId }],
			{
				amountCents: notice.amountCents,
				currency: CURRENCY,
				dueDate: notice.dueDate
			},
			{
				dedupeKey: `balance_overdue:${notice.playerId}:${notice.installment}:${notice.dueDate}`
			}
		);
	}
	return created;
}

export function applyDefaultPlan(actor: Actor, playerId: string): BalanceView | null {
	requirePermission(actor, 'recordPayments');
	const player = getPlayer(actor, playerId);
	if (!('age' in player)) {
		throw new AppError('NOT_FOUND', { key: 'error.playerNotFound' });
	}
	const settings = getSettings();
	const total = applyDiscount(
		settings['finance.totalCents'],
		player.position === 'goalie' ? settings['finance.goalieDiscountPercent'] : 0
	);
	if (total <= 0) {
		throw new AppError('VALIDATION', { key: 'balance.feeNotSet' });
	}
	const amounts = splitPlan(total, settings['finance.firstInstallmentPercent']);
	const now = clock.nowMs();

	db.transaction((tx) => {
		upsertPlan(
			{
				id: findPlan(playerId)?.id ?? newId('plan'),
				playerId,
				totalCents: amounts.totalCents,
				firstCents: amounts.firstCents,
				secondCents: amounts.secondCents,
				firstDueDate: settings['finance.installment1Due'],
				secondDueDate: settings['finance.installment2Due'],
				createdAt: now,
				updatedAt: now
			},
			tx
		);
		recordAudit(
			actor,
			{
				action: 'finance.plan_default',
				entityType: 'player',
				entityId: playerId,
				metadata: { totalCents: amounts.totalCents }
			},
			tx
		);
	});

	return getPlayerBalance(actor, playerId);
}

export function setPlan(
	actor: Actor,
	playerId: string,
	input: PaymentPlanInput
): BalanceView | null {
	requirePermission(actor, 'recordPayments');
	getPlayer(actor, playerId);
	const parsed = parseSchema(paymentPlanInputSchema, input);
	const amounts = splitPlan(parsed.totalCents, parsed.firstPercent);
	const now = clock.nowMs();
	const existing = findPlan(playerId);

	db.transaction((tx) => {
		upsertPlan(
			{
				id: existing?.id ?? newId('plan'),
				playerId,
				totalCents: amounts.totalCents,
				firstCents: amounts.firstCents,
				secondCents: amounts.secondCents,
				firstDueDate: parsed.firstDueDate,
				secondDueDate: parsed.secondDueDate,
				createdAt: now,
				updatedAt: now
			},
			tx
		);
		recordAudit(
			actor,
			{
				action: 'finance.plan_set',
				entityType: 'player',
				entityId: playerId,
				metadata: { totalCents: amounts.totalCents }
			},
			tx
		);
	});

	return getPlayerBalance(actor, playerId);
}

export function recordPayment(
	actor: Actor,
	playerId: string,
	input: PaymentInput
): BalanceView | null {
	requirePermission(actor, 'recordPayments');
	getPlayer(actor, playerId);
	const parsed = parseSchema(paymentInputSchema, input);
	if (!planIsActive(planFromRow(findPlan(playerId)))) {
		throw new AppError('CONFLICT', { key: 'balance.noPlan' });
	}

	db.transaction((tx) => {
		insertPayment(
			{
				id: newId('pay'),
				playerId,
				amountCents: parsed.amountCents,
				paidAt: parsed.paidAt,
				method: parsed.method,
				note: parsed.note,
				recordedBy: actor.kind === 'user' ? actor.userId : null,
				createdAt: clock.nowMs()
			},
			tx
		);
		recordAudit(
			actor,
			{
				action: 'finance.payment',
				entityType: 'player',
				entityId: playerId,
				metadata: { amountCents: parsed.amountCents, method: parsed.method }
			},
			tx
		);
	});

	return getPlayerBalance(actor, playerId);
}

export function removePayment(actor: Actor, playerId: string, paymentId: string): void {
	requirePermission(actor, 'recordPayments');
	const payment = findPayment(paymentId);
	if (!payment || payment.playerId !== playerId) {
		throw new AppError('NOT_FOUND', { key: 'balance.paymentNotFound' });
	}
	db.transaction((tx) => {
		deletePayment(paymentId, tx);
		recordAudit(
			actor,
			{
				action: 'finance.payment_deleted',
				entityType: 'player',
				entityId: playerId,
				metadata: { paymentId }
			},
			tx
		);
	});
}
