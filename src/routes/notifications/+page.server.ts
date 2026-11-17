import { redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import {
	listInboxPage,
	markAllInboxRead,
	openInboxItem,
	unreadCount
} from '#lib/domain/notifications/service.ts';
import { actionError } from '#lib/server/action.ts';
import { decodeCursor } from '#lib/shared/paging/cursor.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const openSchema = z.object({
	id: z.string().min(1)
});

export const load: ServerLoad = ({ locals, url }) => {
	const actor = locals.actor;
	const before = decodeCursor(url.searchParams.get('before'));
	if (actor.kind !== 'user') {
		return { items: [], unread: 0, nextCursor: null, before: null };
	}
	const page = listInboxPage(actor, before);
	return {
		items: page.items,
		nextCursor: page.nextCursor,
		before: before ? url.searchParams.get('before') : null,
		unread: unreadCount(actor)
	};
};

export const actions: Actions = {
	read: async ({ locals }) => {
		try {
			markAllInboxRead(locals.actor);
			return { ok: true, message: t('notifications.allRead') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	open: async ({ request, locals }) => {
		try {
			const parsed = parseForm(openSchema, await request.formData());
			const url = openInboxItem(locals.actor, parsed.id);
			redirect(303, url);
		} catch (cause) {
			return actionError(cause);
		}
	}
};
