import { describe, expect, it } from 'vitest';
import { applyDiscount, splitPlan } from './plan.ts';
import { computeBalance, planIsActive, type PaymentPlan } from './policy.ts';

const plan: PaymentPlan = {
	totalCents: 30_000,
	firstCents: 15_000,
	secondCents: 15_000,
	firstDueDate: '2026-11-01',
	secondDueDate: '2026-12-01'
};

describe('computeBalance', () => {
	const cases = [
		{
			name: 'nothing paid',
			payments: [],
			today: '2026-11-16',
			grace: 0,
			expected: {
				paid: 0,
				outstanding: 30_000,
				overdue: 15_000,
				statuses: ['overdue', 'upcoming']
			}
		},
		{
			name: 'first installment partially paid but overdue',
			payments: [{ amountCents: 10_000, paidAt: '2026-10-30' }],
			today: '2026-11-16',
			grace: 0,
			expected: {
				paid: 10_000,
				outstanding: 20_000,
				overdue: 5_000,
				statuses: ['overdue', 'upcoming']
			}
		},
		{
			name: 'first installment paid',
			payments: [{ amountCents: 15_000, paidAt: '2026-10-30' }],
			today: '2026-11-16',
			grace: 0,
			expected: {
				paid: 15_000,
				outstanding: 15_000,
				overdue: 0,
				statuses: ['paid', 'upcoming']
			}
		},
		{
			name: 'grace period hides the first overdue',
			payments: [],
			today: '2026-11-16',
			grace: 30,
			expected: {
				paid: 0,
				outstanding: 30_000,
				overdue: 0,
				statuses: ['upcoming', 'upcoming']
			}
		},
		{
			name: 'second installment overdue',
			payments: [{ amountCents: 15_000, paidAt: '2026-10-30' }],
			today: '2026-12-05',
			grace: 0,
			expected: {
				paid: 15_000,
				outstanding: 15_000,
				overdue: 15_000,
				statuses: ['paid', 'overdue']
			}
		},
		{
			name: 'overpayment does not create a negative balance',
			payments: [{ amountCents: 40_000, paidAt: '2026-10-30' }],
			today: '2026-12-05',
			grace: 0,
			expected: {
				paid: 40_000,
				outstanding: 0,
				overdue: 0,
				statuses: ['paid', 'paid']
			}
		}
	] as const;

	for (const testCase of cases) {
		it(testCase.name, () => {
			const balance = computeBalance(
				plan,
				testCase.payments,
				testCase.today,
				testCase.grace
			);

			expect(balance.paidCents).toBe(testCase.expected.paid);
			expect(balance.outstandingCents).toBe(testCase.expected.outstanding);
			expect(balance.overdueCents).toBe(testCase.expected.overdue);
			expect(balance.installments.map((entry) => entry.status)).toEqual(
				testCase.expected.statuses
			);
		});
	}

	it('handles a plan without due dates', () => {
		const balance = computeBalance(
			{ ...plan, firstDueDate: null, secondDueDate: null },
			[],
			'2026-12-05',
			0
		);

		expect(balance.isOverdue).toBe(false);
		expect(balance.installments.map((entry) => entry.status)).toEqual([
			'upcoming',
			'upcoming'
		]);
	});
});

describe('plan amounts', () => {
	it('splits without losing a cent', () => {
		expect(splitPlan(10_001, 50)).toEqual({
			totalCents: 10_001,
			firstCents: 5_001,
			secondCents: 5_000
		});
	});

	it('applies a goalie discount before splitting', () => {
		const discounted = applyDiscount(35_000, 50);
		expect(discounted).toBe(17_500);
		expect(splitPlan(discounted, 50)).toMatchObject({
			firstCents: 8_750,
			secondCents: 8_750
		});
	});

	it('never returns a negative amount', () => {
		expect(applyDiscount(35_000, 120)).toBe(0);
		expect(applyDiscount(35_000, -10)).toBe(35_000);
	});
});

describe('planIsActive', () => {
	it.each([
		['aucun plan', null, false],
		['plan à zéro', { ...plan, totalCents: 0 }, false],
		['plan normal', plan, true]
	])('%s', (_label, value, expected) => {
		expect(planIsActive(value as PaymentPlan | null)).toBe(expected);
	});
});
