import {
	CHAT_DELETED_SYNC_LIMIT,
	CHAT_PAGE_SIZE,
	CHAT_POLL_SYNC_LIMIT,
	CHAT_SYNC_PAGE_SIZE,
	HOME_POLL_LIMIT
} from '#config/chat.ts';
import type { Position } from '#config/positions.ts';
import { canCreatePoll, can, requireUser } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { auditEntry } from '#lib/domain/audit/service.ts';
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
	listDeletedMessageIds,
	listLatestVisibleMessage,
	listMessages,
	listMessagesAfter,
	listOpenPollMessages,
	listOptions,
	listPollMessageRows,
	listPolls,
	listVotes,
	softDeleteMessage,
	type MessageRow
} from './queries.ts';
import { decodeCursor, encodeCursor } from '#lib/shared/paging/cursor.ts';
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
	/** Identité visuelle : la même partout dans l'application. */
	authorAvatarId: string | null;
	authorJerseyNumber: number | null;
	authorPosition: Position | null;
	/** Un message du membre connecté se lit d'un coup d'œil. */
	isOwn: boolean;
	kind: 'text' | 'poll';
	body: string | null;
	createdAt: number;
	deleted: boolean;
	poll: ChatPollView | null;
	canDelete: boolean;
};

function toViews(
	actor: Actor,
	userId: string,
	messages: readonly MessageRow[]
): ChatMessageView[] {
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
			authorAvatarId: message.authorAvatarId,
			authorJerseyNumber: message.authorJerseyNumber,
			authorPosition: message.authorPosition,
			isOwn: message.authorUserId === userId,
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

export type ChatPage = {
	messages: ChatMessageView[];
	/** Curseur de la page précédente, null quand l'historique est complet. */
	nextCursor: string | null;
};

export function listChatPage(actor: Actor, beforeValue?: string | null): ChatPage {
	const user = requireUser(actor);
	const settings = getSettings();
	const pageSize = Math.min(settings['chat.pageSize'], CHAT_PAGE_SIZE);
	const rows = listMessages(pageSize + 1, decodeCursor(beforeValue));
	const hasMore = rows.length > pageSize;
	const page = hasMore ? rows.slice(0, pageSize) : rows;
	const oldest = page.at(-1);
	return {
		messages: toViews(actor, user.userId, page),
		nextCursor: hasMore && oldest ? encodeCursor(oldest) : null
	};
}

export type ChatPollState = { id: string; poll: ChatPollView | null };

export type ChatSyncPage = {
	/** Les messages postérieurs au curseur, du plus ancien au plus récent. */
	messages: ChatMessageView[];
	/** Les identifiants supprimés depuis `deletedSince`, du plus ancien au plus récent. */
	deletedIds: string[];
	/**
	 * Vrai quand le rattrapage des suppressions dépasse sa borne : l'appareil
	 * doit alors jeter sa copie et repartir du serveur, jamais avancer son
	 * instant en sautant des suppressions.
	 */
	reset: boolean;
	/** L'état courant de chaque sondage du catalogue borné. */
	polls: ChatPollState[];
	/** Le curseur à passer comme `after` quand `hasMore` est vrai. */
	nextAfter: string | null;
	hasMore: boolean;
	/** L'heure du serveur à conserver comme prochain `deletedSince`. */
	now: number;
};

/**
 * La synchronisation d'un appareil : les messages écrits après son curseur,
 * les suppressions rattrapées depuis son instant, et l'état courant des
 * sondages. Une page vide n'est pas la fin de l'historique; seul `hasMore`
 * décide de continuer.
 */
export function syncChat(
	actor: Actor,
	input: { after: string; deletedSince?: number | null }
): ChatSyncPage {
	const user = requireUser(actor);
	const cursor = decodeCursor(input.after);
	if (cursor === null) {
		throw new AppError('VALIDATION', { key: 'chat.invalidCursor' });
	}
	const deletedSince = input.deletedSince ?? null;
	if (
		deletedSince !== null &&
		(!Number.isSafeInteger(deletedSince) || deletedSince < 0)
	) {
		throw new AppError('VALIDATION', { key: 'chat.invalidCursor' });
	}

	// Le curseur des suppressions précède la lecture d'une milliseconde : une
	// suppression committée pendant la requête est rejouée au prochain passage,
	// jamais sautée. Une suppression rejouée est idempotente.
	const now = Math.max(0, clock.nowMs() - 1);
	const rows = listMessagesAfter(CHAT_SYNC_PAGE_SIZE + 1, cursor);
	const hasMore = rows.length > CHAT_SYNC_PAGE_SIZE;
	const page = hasMore ? rows.slice(0, CHAT_SYNC_PAGE_SIZE) : rows;
	const deleted =
		deletedSince === null
			? []
			: listDeletedMessageIds(deletedSince, CHAT_DELETED_SYNC_LIMIT + 1);
	// La borne est dépassée : une page partielle ne doit jamais faire avancer
	// `deletedSince`, sinon les suppressions suivantes seraient perdues.
	const reset = deleted.length > CHAT_DELETED_SYNC_LIMIT;
	const polls = toViews(actor, user.userId, listPollMessageRows(CHAT_POLL_SYNC_LIMIT)).map(
		(view) => ({ id: view.id, poll: view.poll })
	);
	return {
		messages: toViews(actor, user.userId, page),
		deletedIds: reset ? [] : deleted,
		reset,
		polls,
		nextAfter: hasMore ? encodeCursor(page.at(-1)!) : null,
		hasMore,
		now
	};
}

export type HomeChatSummary = {
	latestMessage: ChatMessageView | null;
	openPoll: { messageId: string; poll: ChatPollView; unvoted: boolean } | null;
};

/**
 * L'accueil n'a besoin que du dernier message et d'un sondage ouvert. On
 * interroge donc les sondages ouverts et un seul message, jamais la page de
 * discussion complète.
 */
export function listChatSummary(actor: Actor): HomeChatSummary {
	const user = requireUser(actor);
	const latestRow = listLatestVisibleMessage();
	const pollRows = listOpenPollMessages(clock.nowMs(), HOME_POLL_LIMIT);
	const byId = new Map<string, MessageRow>();
	if (latestRow) byId.set(latestRow.id, latestRow);
	for (const row of pollRows) byId.set(row.id, row);
	const views = toViews(actor, user.userId, [...byId.values()]);
	const latest = latestRow
		? (views.find((view) => view.id === latestRow.id) ?? null)
		: null;
	const polls = views.filter((view) => view.poll !== null && !view.poll.closed);
	const openPoll =
		polls.find((view) => view.poll?.options.every((option) => !option.myVote)) ??
		polls[0] ??
		null;
	return {
		latestMessage: latest,
		openPoll: openPoll?.poll
			? {
					messageId: openPoll.id,
					poll: openPoll.poll,
					unvoted: openPoll.poll.options.every((option) => !option.myVote)
				}
			: null
	};
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
		createdAt,
		audit: auditEntry(actor, {
			action: 'chat.poll_created',
			entityType: 'chat_message',
			entityId: messageId
		})
	});
	return messageId;
}

export function castPollVote(
	actor: Actor,
	input: { messageId: string; optionId: string }
): void {
	const user = requireUser(actor);
	const parsed = parseSchema(voteInputSchema, input);
	const message = findMessage(parsed.messageId);
	if (!message) {
		throw new AppError('NOT_FOUND', { key: 'chat.messageNotFound' });
	}
	if (message.deletedAt !== null) {
		throw new AppError('NOT_FOUND', { key: 'chat.messageNotFound' });
	}
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
	closePoll(
		messageId,
		clock.nowMs(),
		auditEntry(actor, {
			action: 'chat.poll_closed',
			entityType: 'chat_message',
			entityId: messageId
		})
	);
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
	softDeleteMessage(
		messageId,
		clock.nowMs(),
		user.userId,
		auditEntry(actor, {
			action: 'chat.message_deleted',
			entityType: 'chat_message',
			entityId: messageId,
			metadata: { authorUserId: message.authorUserId }
		})
	);
}
