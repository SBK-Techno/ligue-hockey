import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { branding } from '#lib/generated/branding.ts';
import { PAYMENT_METHOD_KEYS } from '#config/payment-methods.ts';
import { ROLE_KEYS } from '#config/roles.ts';
import {
	applyDefaultPlan,
	getPlayerBalance,
	listPlayerPayments,
	recordPayment,
	removePayment,
	setPlan
} from '#lib/domain/finance/service.ts';
import {
	adminUpdatePlayer,
	deletePlayer,
	getAdminPlayer,
	resendInvite,
	setPlayerRole
} from '#lib/domain/players/service.ts';
import { adminUpdatePlayerSchema } from '#lib/domain/players/validators.ts';
import { getRatings } from '#lib/domain/ratings/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { applyDiscount, splitPlan } from '#lib/domain/finance/plan.ts';
import { listSubstitutes, setSubstituteFavorite } from '#lib/domain/subs/service.ts';
import { actionError } from '#lib/server/action.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { centsToInput, t, parseMoneyToCents } from '#lib/shared/i18n/index.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';
import { parseForm } from '#lib/shared/validation.ts';


const roleSchema = z.object({ role: z.enum(ROLE_KEYS) });
const statusSchema = z.object({
	active: z.enum(['true', 'false']).transform((value) => value === 'true')
});

const planSchema = z.object({
	total: z.string().min(1),
	firstPercent: z.coerce.number().int().min(1).max(99),
	firstDueDate: z.string(),
	secondDueDate: z.string()
});

const paymentSchema = z.object({
	amount: z.string().min(1),
	paidAt: z.string().min(1),
	method: z.enum(PAYMENT_METHOD_KEYS),
	note: z.string().max(500).optional()
});

const idSchema = z.object({ paymentId: z.string().min(1) });
const favoriteSchema = z.object({
	value: z.enum(['true', 'false']).transform((value) => value === 'true')
});

function moneyToCents(value: string): number {
	const cents = parseMoneyToCents(value);
	if (cents === null) {
		throw new Error('invalid-money');
	}
	return cents;
}

export const load: ServerLoad = ({ locals, params }) => {
	const actor = locals.actor;
	const settings = getSettings();
	const currency = settings['finance.currency'];
	if (actor.kind !== 'user' || !params.id) {
		return {
			player: null,
			ratings: null,
			balance: null,
			payments: [],
			plan: null,
			isFavorite: false,
			currency
		};
	}

	let player;
	try {
		player = getAdminPlayer(actor, params.id);
	} catch (cause) {
		if (isAppError(cause) && cause.code === 'NOT_FOUND') {
			return {
				player: null,
				ratings: null,
				balance: null,
				payments: [],
				plan: null,
				isFavorite: false,
				currency
			};
		}
		throw cause;
	}
	const balance = getPlayerBalance(actor, params.id);
	const favorite = listSubstitutes(actor).find(
		(substitute) => substitute.playerId === params.id
	)?.favorite;

	const suggestedTotal = applyDiscount(
		settings['finance.totalCents'],
		player.position === 'goalie' ? settings['finance.goalieDiscountPercent'] : 0
	);
	const suggested = splitPlan(suggestedTotal, settings['finance.firstInstallmentPercent']);
	const firstPercent =
		balance && balance.totalCents > 0
			? Math.round((balance.installments[0].amountCents / balance.totalCents) * 100)
			: settings['finance.firstInstallmentPercent'];

	return {
		player,
		ratings: getRatings(actor, params.id),
		balance,
		payments: listPlayerPayments(actor, params.id),
		isFavorite: favorite ?? false,
		currency,
		plan: {
			total: centsToInput(balance?.totalCents ?? suggested.totalCents),
			firstPercent,
			firstDueDate: balance?.installments[0].dueDate ?? settings['finance.installment1Due'] ?? '',
			secondDueDate: balance?.installments[1].dueDate ?? settings['finance.installment2Due'] ?? '',
			amount: centsToInput(balance?.outstandingCents ?? suggested.totalCents),
			today: todayInZone(branding.timezone, clock.nowMs())
		}
	};
};

export const actions: Actions = {
	profile: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(adminUpdatePlayerSchema, await request.formData());
			await adminUpdatePlayer(locals.actor, params.id!, parsed);
			return { ok: true, message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	plan: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(planSchema, await request.formData());
			setPlan(locals.actor, params.id!, {
				totalCents: moneyToCents(parsed.total),
				firstPercent: parsed.firstPercent,
				firstDueDate: parsed.firstDueDate || null,
				secondDueDate: parsed.secondDueDate || null
			});
			return { ok: true, message: t('admin.planSaved') };
		} catch (cause) {
			if (cause instanceof Error && cause.message === 'invalid-money') {
				return fail(400, { ok: false, message: t('balance.amountInvalid') });
			}
			return actionError(cause);
		}
	},
	applyDefaults: async ({ locals, params }) => {
		try {
			applyDefaultPlan(locals.actor, params.id!);
			return { ok: true, message: t('admin.planSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	payment: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(paymentSchema, await request.formData());
			recordPayment(locals.actor, params.id!, {
				amountCents: moneyToCents(parsed.amount),
				paidAt: parsed.paidAt,
				method: parsed.method,
				note: parsed.note || null
			});
			return { ok: true, message: t('admin.paymentSaved') };
		} catch (cause) {
			if (cause instanceof Error && cause.message === 'invalid-money') {
				return fail(400, { ok: false, message: t('balance.amountInvalid') });
			}
			return actionError(cause);
		}
	},
	deletePayment: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(idSchema, await request.formData());
			removePayment(locals.actor, params.id!, parsed.paymentId);
			return { ok: true, message: t('admin.paymentDeleted') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	role: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(roleSchema, await request.formData());
			await setPlayerRole(locals.actor, params.id!, parsed.role);
			return { ok: true, message: t('admin.roleSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	status: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(statusSchema, await request.formData());
			await adminUpdatePlayer(locals.actor, params.id!, {
				active: parsed.active
			});
			return { ok: true, message: t('admin.statusSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	delete: async ({ locals, params }) => {
		try {
			await deletePlayer(locals.actor, params.id!);
		} catch (cause) {
			return actionError(cause);
		}
		redirect(303, '/admin/joueurs');
	},
	resend: async ({ locals, params }) => {
		try {
			await resendInvite(locals.actor, params.id!);
			return { ok: true, message: t('admin.inviteResent') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	favorite: async ({ request, locals, params }) => {
		try {
			const parsed = parseForm(favoriteSchema, await request.formData());
			setSubstituteFavorite(locals.actor, {
				playerId: params.id!,
				favorite: parsed.value
			});
			return { ok: true, message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
