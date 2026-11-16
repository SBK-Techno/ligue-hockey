export type PaymentPlanAmounts = {
	totalCents: number;
	firstCents: number;
	secondCents: number;
};

export function splitPlan(
	totalCents: number,
	firstPercent: number
): PaymentPlanAmounts {
	const firstCents = Math.round((totalCents * firstPercent) / 100);
	return {
		totalCents,
		firstCents,
		secondCents: totalCents - firstCents
	};
}

export function applyDiscount(totalCents: number, discountPercent: number): number {
	if (discountPercent <= 0) return totalCents;
	if (discountPercent >= 100) return 0;
	return Math.round((totalCents * (100 - discountPercent)) / 100);
}
