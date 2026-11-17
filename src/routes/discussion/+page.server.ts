import type { Actions, ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import {
	castPollVote,
	closePollAsAdmin,
	createPoll,
	deleteChatMessage,
	listChat,
	sendMessage
} from '#lib/domain/chat/service.ts';
import { canCreatePoll } from '#lib/domain/auth/policy.ts';
import { CHAT_LIMITS, voteInputSchema } from '#lib/domain/chat/validators.ts';
import { branding } from '#lib/generated/branding.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { actionError } from '#lib/server/action.ts';
import { throttleMemberAction } from '#lib/server/security/member-action.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { DAY_MS } from '#config/time.ts';
import { clock, todayInZone } from '#lib/shared/time/clock.ts';
import { parseForm } from '#lib/shared/validation.ts';

const messageSchema = z.object({
	body: z.string().trim().min(1).max(CHAT_LIMITS.messageMax)
});
const idSchema = z.object({ messageId: z.string().min(1) });

export const load: ServerLoad = ({ locals }) => {
	const settings = getSettings();
	const limits = {
		messageMax: settings['chat.maxMessageLength'],
		questionMax: CHAT_LIMITS.questionMax,
		optionMax: CHAT_LIMITS.optionMax,
		pollMinOptions: settings['chat.pollMinOptions'],
		pollMaxOptions: settings['chat.maxPollOptions']
	};
	const days = {
		today: todayInZone(branding.timezone),
		yesterday: todayInZone(branding.timezone, clock.nowMs() - DAY_MS)
	};
	if (locals.actor.kind !== 'user') {
		return { messages: [], limits, canCreatePoll: false, ...days };
	}
	return {
		messages: listChat(locals.actor),
		limits,
		canCreatePoll: canCreatePoll(locals.actor, settings['chat.allowPlayerPolls']),
		...days
	};
};

export const actions: Actions = {
	send: async ({ request, locals }) => {
		try {
			throttleMemberAction(locals.actor);
			const parsed = parseForm(messageSchema, await request.formData());
			sendMessage(locals.actor, parsed);
			return { ok: true, message: t('chat.sent') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	poll: async ({ request, locals }) => {
		try {
			const form = await request.formData();
			const question = String(form.get('question') ?? '');
			const options = form
				.getAll('options')
				.map((value) => String(value).trim())
				.filter((value) => value.length > 0);
			createPoll(locals.actor, { question, options });
			return { ok: true, message: t('chat.pollCreated') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	vote: async ({ request, locals }) => {
		try {
			const parsed = parseForm(voteInputSchema, await request.formData());
			castPollVote(locals.actor, parsed);
			return { ok: true, message: t('chat.voteSaved') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	delete: async ({ request, locals }) => {
		try {
			const parsed = parseForm(idSchema, await request.formData());
			deleteChatMessage(locals.actor, parsed.messageId);
			return { ok: true, message: t('chat.deleted') };
		} catch (cause) {
			return actionError(cause);
		}
	},
	closePoll: async ({ request, locals }) => {
		try {
			const parsed = parseForm(idSchema, await request.formData());
			closePollAsAdmin(locals.actor, parsed.messageId);
			return { ok: true, message: t('chat.pollClosedNotice') };
		} catch (cause) {
			return actionError(cause);
		}
	}
};
