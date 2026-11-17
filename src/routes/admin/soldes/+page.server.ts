import type { ServerLoad } from '@sveltejs/kit';
import { CURRENCY } from '#config/currency.ts';
import { listBalances } from '#lib/domain/finance/service.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	const currency = CURRENCY;
	if (actor.kind !== 'user') return { balances: [], totals: {}, currency };
	const balances = listBalances(actor);
	return {
		balances,
		currency,
		totals: {
			total: balances.reduce((sum, row) => sum + row.totalCents, 0),
			paid: balances.reduce((sum, row) => sum + row.paidCents, 0),
			outstanding: balances.reduce((sum, row) => sum + row.outstandingCents, 0),
			overdue: balances.filter((row) => row.isOverdue).length
		}
	};
};
