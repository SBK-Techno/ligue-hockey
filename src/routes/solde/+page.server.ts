import type { ServerLoad } from '@sveltejs/kit';
import { getMyBalance, listMyPayments } from '#lib/domain/finance/service.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { balance: null, payments: [] };
	return {
		balance: getMyBalance(actor),
		payments: listMyPayments(actor)
	};
};
