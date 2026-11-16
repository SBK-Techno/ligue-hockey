import type { ServerLoad } from '@sveltejs/kit';
import { getMyBalance, listMyPayments } from '#lib/domain/finance/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	const seasonLabel = getSettings()['league.seasonLabel'];
	if (actor.kind !== 'user') return { balance: null, payments: [], seasonLabel };
	return {
		balance: getMyBalance(actor),
		payments: listMyPayments(actor),
		seasonLabel
	};
};
