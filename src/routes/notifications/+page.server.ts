import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import {
	listInbox,
	markInboxRead,
	unreadCount
} from '#lib/domain/notifications/service.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const readSchema = z.object({
	ids: z.preprocess(
		(value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
		z.array(z.string().min(1))
	)
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { items: [], unread: 0 };
	return {
		items: listInbox(actor, { limit: 50 }),
		unread: unreadCount(actor)
	};
};

export const actions: Actions = {
	read: async ({ request, locals }) => {
		try {
			const parsed = parseForm(readSchema, await request.formData());
			markInboxRead(locals.actor, parsed.ids);
			return { message: t('common.saved') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
