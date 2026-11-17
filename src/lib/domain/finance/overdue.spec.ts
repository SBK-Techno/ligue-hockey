import { describe, expect, it } from 'vitest';
import { overdueNotices, type OverdueCandidate } from './overdue.ts';

const plan = {
	totalCents: 30_000,
	firstCents: 15_000,
	secondCents: 15_000,
	firstDueDate: '2026-11-01',
	secondDueDate: '2026-12-01'
};

function candidate(payments: OverdueCandidate['payments'] = []): OverdueCandidate {
	return { playerId: 'player', plan, payments };
}

describe('avis de retard', () => {
	it('ne signale rien avant la date due', () => {
		expect(overdueNotices([candidate()], '2026-10-31', 0)).toEqual([]);
	});

	it('signale la transition vers le retard avec le restant dû', () => {
		expect(overdueNotices([candidate()], '2026-11-01', 0)).toEqual([]);
		expect(overdueNotices([candidate()], '2026-11-02', 0)).toEqual([
			{
				playerId: 'player',
				installment: 1,
				amountCents: 15_000,
				dueDate: '2026-11-01'
			}
		]);
	});

	it('respecte la marge et ne réclame que le restant', () => {
		const payments = [{ amountCents: 5_000, paidAt: '2026-10-15' }];
		expect(overdueNotices([candidate(payments)], '2026-11-02', 7)).toEqual([]);
		expect(overdueNotices([candidate(payments)], '2026-11-09', 7)).toEqual([
			{
				playerId: 'player',
				installment: 1,
				amountCents: 10_000,
				dueDate: '2026-11-01'
			}
		]);
	});

	it('distingue les deux versements d’un même plan', () => {
		expect(overdueNotices([candidate()], '2026-12-02', 0)).toEqual([
			{
				playerId: 'player',
				installment: 1,
				amountCents: 15_000,
				dueDate: '2026-11-01'
			},
			{
				playerId: 'player',
				installment: 2,
				amountCents: 15_000,
				dueDate: '2026-12-01'
			}
		]);
	});

	it('ignore un plan inactif ou soldé', () => {
		expect(
			overdueNotices(
				[{ playerId: 'player', plan: { ...plan, totalCents: 0 }, payments: [] }],
				'2027-01-01',
				0
			)
		).toEqual([]);
		expect(
			overdueNotices(
				[candidate([{ amountCents: 30_000, paidAt: '2026-10-01' }])],
				'2027-01-01',
				0
			)
		).toEqual([]);
	});
});
