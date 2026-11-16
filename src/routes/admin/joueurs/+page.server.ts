import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { listAdminPlayers, invitePlayer, resendInvite, adminUpdatePlayer } from '#lib/domain/players/service.ts';
import { setSubstituteFavorite, listSubstitutes } from '#lib/domain/subs/service.ts';
import { invitePlayerSchema } from '#lib/domain/players/validators.ts';
import { actionError } from '#lib/server/action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { parseForm } from '#lib/shared/validation.ts';

const playerActionSchema = z.object({
	playerId: z.string().min(1)
});

const toggleSchema = z.object({
	playerId: z.string().min(1),
	value: z.enum(['true', 'false']).transform((value) => value === 'true')
});

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	if (actor.kind !== 'user') return { players: [], favorites: new Map() };
	return {
		players: listAdminPlayers(actor),
		favorites: new Map(
			listSubstitutes(actor).map((substitute) => [
				substitute.playerId,
				substitute.favorite ?? false
			])
		)
	};
};

export const actions: Actions = {
	invite: async ({ request, locals }) => {
		try {
			const parsed = parseForm(invitePlayerSchema, await request.formData());
			const result = await invitePlayer(locals.actor, parsed);
			return {
				message: result.inviteSent
					? t('admin.inviteSent', { email: parsed.email })
					: t('admin.inviteEmailFailed')
			};
		} catch (cause) {
			return actionError(cause);
		}
	},
	resend: async ({ request, locals }) => {
		try {
			const parsed = parseForm(playerActionSchema, await request.formData());
			await resendInvite(locals.actor, parsed.playerId);
			return { message: t('admin.inviteResent') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	active: async ({ request, locals }) => {
		try {
			const parsed = parseForm(toggleSchema, await request.formData());
			adminUpdatePlayer(locals.actor, parsed.playerId, { active: parsed.value });
			return { message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	substitute: async ({ request, locals }) => {
		try {
			const parsed = parseForm(toggleSchema, await request.formData());
			adminUpdatePlayer(locals.actor, parsed.playerId, { isSubstitute: parsed.value });
			return { message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	favorite: async ({ request, locals }) => {
		try {
			const parsed = parseForm(toggleSchema, await request.formData());
			setSubstituteFavorite(locals.actor, {
				playerId: parsed.playerId,
				favorite: parsed.value
			});
			return { message: t('admin.playerSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
