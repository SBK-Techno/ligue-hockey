import { addDays } from '#lib/shared/time/clock.ts';

export type PaymentPlan = {
	totalCents: number;
	firstCents: number;
	secondCents: number;
	firstDueDate: string | null;
	secondDueDate: string | null;
};

export type Payment = {
	amountCents: number;
	paidAt: string;
};

export type InstallmentStatus = 'paid' | 'partial' | 'overdue' | 'upcoming';

/**
 * Un plan sans montant n'est pas un plan : il ne doit ni afficher « Payé »
 * ni compter dans les joueurs sans versements.
 */
export function planIsActive(plan: PaymentPlan | null): boolean {
	return plan !== null && plan.totalCents > 0;
}

export type InstallmentBalance = {
	number: 1 | 2;
	amountCents: number;
	paidCents: number;
	remainingCents: number;
	dueDate: string | null;
	status: InstallmentStatus;
};

export type Balance = {
	totalCents: number;
	paidCents: number;
	outstandingCents: number;
	overdueCents: number;
	isOverdue: boolean;
	installments: [InstallmentBalance, InstallmentBalance];
};

function statusFor(
	amountCents: number,
	paidCents: number,
	dueDate: string | null,
	today: string,
	graceDays: number
): InstallmentStatus {
	const remaining = Math.max(0, amountCents - paidCents);
	if (remaining === 0) return 'paid';
	if (dueDate && today > addDays(dueDate, graceDays)) return 'overdue';
	if (paidCents > 0) return 'partial';
	return 'upcoming';
}

export function computeBalance(
	plan: PaymentPlan,
	payments: readonly Payment[],
	today: string,
	graceDays: number
): Balance {
	const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
	const firstPaid = Math.min(paidCents, plan.firstCents);
	const secondPaid = Math.min(
		Math.max(paidCents - plan.firstCents, 0),
		plan.secondCents
	);

	const installments: [InstallmentBalance, InstallmentBalance] = [
		{
			number: 1,
			amountCents: plan.firstCents,
			paidCents: firstPaid,
			remainingCents: Math.max(0, plan.firstCents - firstPaid),
			dueDate: plan.firstDueDate,
			status: statusFor(
				plan.firstCents,
				firstPaid,
				plan.firstDueDate,
				today,
				graceDays
			)
		},
		{
			number: 2,
			amountCents: plan.secondCents,
			paidCents: secondPaid,
			remainingCents: Math.max(0, plan.secondCents - secondPaid),
			dueDate: plan.secondDueDate,
			status: statusFor(
				plan.secondCents,
				secondPaid,
				plan.secondDueDate,
				today,
				graceDays
			)
		}
	];

	const overdueCents = installments
		.filter((installment) => installment.status === 'overdue')
		.reduce((sum, installment) => sum + installment.remainingCents, 0);

	return {
		totalCents: plan.totalCents,
		paidCents,
		outstandingCents: Math.max(0, plan.totalCents - paidCents),
		overdueCents,
		isOverdue: overdueCents > 0,
		installments
	};
}
