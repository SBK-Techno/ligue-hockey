import { canCreatePoll, can, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import {
	castVote,
	closePoll,
	findMessage,
	findOption,
	findPoll,
	insertMessage,
	insertPollMessage,
	listMessages,
	listOptions,
	listPolls,
	listVotes,
	softDeleteMessage
} from './queries.ts';
import { messageInputSchema, pollInputSchema, voteInputSchema } from './validators.ts';

export type ChatPollOptionView = {
	id: string;
	label: string;
	votes: number;
	myVote: boolean;
};

export type ChatPollView = {
	question: string;
	closesAt: number | null;
	closed: boolean;
	options: ChatPollOptionView[];
};

export type ChatMessageView = {
	id: string;
	authorUserId: string;
	authorName: string;
	kind: 'text' | 'poll';
	body: string | null;
	createdAt: number;
	deleted: boolean;
	poll: ChatPollView | null;
	canDelete: boolean;
};

function toViews(actor: Actor, userId: string): ChatMessageView[] {
	const settings = getSettings();
	const messages = listMessages(settings['chat.pageSize'], null);
	const ids = messages.map((message) => message.id);
	const polls = new Map(listPolls(ids).map((poll) => [poll.messageId, poll]));
	const options = new Map<string, { id: string; label: string; optionIndex: number }[]>();
	for (const option of listOptions(ids)) {
		const rows = options.get(option.messageId) ?? [];
		rows.push(option);
		options.set(option.messageId, rows);
	}
	const votes = listVotes(ids);

	return messages.map((message) => {
		const deleted = message.deletedAt !== null;
		const poll = polls.get(message.id);
		const pollOptions = options.get(message.id) ?? [];
		const voteRows = votes.filter((vote) => vote.messageId === message.id);
		const myVote = voteRows.find((vote) => vote.userId === userId)?.optionId ?? null;
		const canModerate = can(actor, 'moderateChat');

		return {
			id: message.id,
			authorUserId: message.authorUserId,
			authorName: message.authorName,
			kind: message.kind,
			body: deleted ? null : message.body,
			createdAt: message.createdAt,
			deleted,
			canDelete: !deleted && (canModerate || message.authorUserId === userId),
			poll:
				poll && !deleted
					? {
							question: poll.question,
							closesAt: poll.closesAt,
							closed: poll.closesAt !== null && poll.closesAt <= clock.nowMs(),
							options: pollOptions.map((option) => ({
								id: option.id,
								label: option.label,
								votes: voteRows.filter((vote) => vote.optionId === option.id).length,
								myVote: myVote === option.id
							}))
						}
					: null
		};
	});
}

export function listChat(actor: Actor): ChatMessageView[] {
	const user = requireUser(actor);
	return toViews(actor, user.userId);
}

export function sendMessage(actor: Actor, input: { body: string }): string {
	const user = requireUser(actor);
	const settings = getSettings();
	const parsed = parseSchema(messageInputSchema, input);
	if (parsed.body.length > settings['chat.maxMessageLength']) {
		throw new AppError('VALIDATION', { key: 'chat.tooLong' });
	}

	const id = newId('msg');
	insertMessage({
		id,
		authorUserId: user.userId,
		kind: 'text',
		body: parsed.body,
		createdAt: clock.nowMs()
	});
	return id;
}

export function createPoll(actor: Actor, input: { question: string; options: unknown }): string {
	const user = requireUser(actor);
	const settings = getSettings();
	if (!canCreatePoll(actor, settings['chat.allowPlayerPolls'])) {
		throw new AppError('FORBIDDEN', { key: 'chat.pollsDisabled' });
	}

	const parsed = parseSchema(pollInputSchema, input);
	const options = [...new Set(parsed.options.map((option) => option.trim()))];
	const minOptions = settings['chat.pollMinOptions'];
	if (options.length < minOptions) {
		throw new AppError('VALIDATION', {
			key: 'chat.pollNeedsOptions',
			params: { min: minOptions }
		});
	}
	if (options.length > settings['chat.maxPollOptions']) {
		throw new AppError('VALIDATION', { key: 'chat.tooManyOptions' });
	}
	if (options.some((option) => option.length === 0)) {
		throw new AppError('VALIDATION', {
			key: 'chat.pollNeedsOptions',
			params: { min: minOptions }
		});
	}

	const messageId = newId('msg');
	const createdAt = clock.nowMs();
	insertPollMessage({
		message: {
			id: messageId,
			authorUserId: user.userId,
			kind: 'poll',
			body: null,
			createdAt
		},
		question: parsed.question,
		options: options.map((label) => ({ id: newId('opt'), label })),
		createdAt
	});

	recordAudit(actor, {
		action: 'chat.poll_created',
		entityType: 'chat_message',
		entityId: messageId
	});
	return messageId;
}

export function castPollVote(
	actor: Actor,
	input: { messageId: string; optionId: string }
): void {
	const user = requireUser(actor);
	const parsed = parseSchema(voteInputSchema, input);
	const poll = findPoll(parsed.messageId);
	if (!poll) {
		throw new AppError('NOT_FOUND', { key: 'chat.pollNotFound' });
	}
	if (poll.closesAt !== null && poll.closesAt <= clock.nowMs()) {
		throw new AppError('CONFLICT', { key: 'chat.voteClosed' });
	}
	const option = findOption(parsed.optionId);
	if (!option || option.messageId !== parsed.messageId) {
		throw new AppError('VALIDATION', { key: 'chat.pollNotFound' });
	}
	if (!castVote(parsed.messageId, parsed.optionId, user.userId, clock.nowMs())) {
		throw new AppError('CONFLICT', { key: 'chat.voteClosed' });
	}
}

export function closePollAsAdmin(actor: Actor, messageId: string): void {
	const user = requireUser(actor);
	const message = findMessage(messageId);
	if (!message) {
		throw new AppError('NOT_FOUND', { key: 'chat.messageNotFound' });
	}
	if (message.authorUserId !== user.userId && !can(user, 'moderateChat')) {
		throw new AppError('FORBIDDEN');
	}
	const poll = findPoll(messageId);
	if (!poll) {
		throw new AppError('NOT_FOUND', { key: 'chat.pollNotFound' });
	}
	closePoll(messageId, clock.nowMs());
	recordAudit(actor, {
		action: 'chat.poll_closed',
		entityType: 'chat_message',
		entityId: messageId
	});
}

export function deleteChatMessage(actor: Actor, messageId: string): void {
	const user = requireUser(actor);
	const message = findMessage(messageId);
	if (!message) {
		throw new AppError('NOT_FOUND', { key: 'chat.messageNotFound' });
	}
	if (message.authorUserId !== user.userId && !can(user, 'moderateChat')) {
		throw new AppError('FORBIDDEN');
	}
	softDeleteMessage(messageId, clock.nowMs(), user.userId);
}
