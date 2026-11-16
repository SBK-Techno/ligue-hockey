import type { Actions, ServerLoad } from '@sveltejs/kit';
import { createRule, deleteRule, listRules } from '#lib/domain/rules/service.ts';
import { listAdminPlayers } from '#lib/domain/players/service.ts';
import { pairRuleDeleteSchema, pairRuleInputSchema } from '#lib/domain/rules/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { rules: [], players: [] };
	return {
		rules: listRules(actor),
		players: listAdminPlayers(actor).filter((player) => player.active)
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		try {
			const parsed = parseForm(pairRuleInputSchema, await request.formData());
			createRule(locals.actor, parsed);
			return { ok: true, message: t('admin.ruleSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	delete: async ({ request, locals }) => {
		try {
			const parsed = parseForm(pairRuleDeleteSchema, await request.formData());
			deleteRule(locals.actor, parsed.id);
			return { ok: true, message: t('admin.ruleDeleted') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
