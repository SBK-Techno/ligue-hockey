import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import {
	chatMessages,
	pollOptions,
	pollVotes,
	polls,
	type ChatMessageRow
} from './schema.ts';

export type MessageRow = ChatMessageRow & { authorName: string };

export function listMessages(limit: number, before: number | null): MessageRow[] {
	return db
		.select({
			id: chatMessages.id,
			authorUserId: chatMessages.authorUserId,
			kind: chatMessages.kind,
			body: chatMessages.body,
			createdAt: chatMessages.createdAt,
			deletedAt: chatMessages.deletedAt,
			deletedBy: chatMessages.deletedBy,
			authorName: user.name
		})
		.from(chatMessages)
		.innerJoin(user, eq(user.id, chatMessages.authorUserId))
		.where(before === null ? undefined : lt(chatMessages.createdAt, before))
		.orderBy(desc(chatMessages.createdAt))
		.limit(limit)
		.all();
}

export function findMessage(id: string): ChatMessageRow | undefined {
	return db.select().from(chatMessages).where(eq(chatMessages.id, id)).get();
}

export function insertMessage(row: typeof chatMessages.$inferInsert): void {
	db.insert(chatMessages).values(row).run();
}

export function insertPollMessage(input: {
	message: typeof chatMessages.$inferInsert;
	question: string;
	options: readonly { id: string; label: string }[];
	createdAt: number;
}): void {
	db.transaction((tx) => {
		tx.insert(chatMessages).values(input.message).run();
		tx.insert(polls)
			.values({
				messageId: input.message.id,
				question: input.question,
				closesAt: null,
				createdAt: input.createdAt
			})
			.run();
		input.options.forEach((option, index) => {
			tx.insert(pollOptions)
				.values({
					id: option.id,
					messageId: input.message.id,
					label: option.label,
					optionIndex: index
				})
				.run();
		});
	});
}

export function listPolls(messageIds: readonly string[]) {
	if (messageIds.length === 0) return [];
	return db
		.select()
		.from(polls)
		.where(inArray(polls.messageId, [...messageIds]))
		.all();
}

export function listOptions(messageIds: readonly string[]) {
	if (messageIds.length === 0) return [];
	return db
		.select()
		.from(pollOptions)
		.where(inArray(pollOptions.messageId, [...messageIds]))
		.orderBy(asc(pollOptions.optionIndex))
		.all();
}

export function listVotes(messageIds: readonly string[]) {
	if (messageIds.length === 0) return [];
	return db
		.select()
		.from(pollVotes)
		.where(inArray(pollVotes.messageId, [...messageIds]))
		.all();
}

export function findOption(optionId: string) {
	return db
		.select()
		.from(pollOptions)
		.where(eq(pollOptions.id, optionId))
		.get();
}

export function castVote(
	messageId: string,
	optionId: string,
	userId: string,
	createdAt: number
): void {
	db.insert(pollVotes)
		.values({ messageId, optionId, userId, createdAt })
		.onConflictDoUpdate({
			target: [pollVotes.messageId, pollVotes.userId],
			set: { optionId, createdAt }
		})
		.run();
}

export function closePoll(messageId: string, closesAt: number): void {
	db.update(polls).set({ closesAt }).where(eq(polls.messageId, messageId)).run();
}

export function softDeleteMessage(
	id: string,
	deletedAt: number,
	deletedBy: string
): void {
	db.update(chatMessages)
		.set({ deletedAt, deletedBy })
		.where(and(eq(chatMessages.id, id), isNull(chatMessages.deletedAt)))
		.run();
}

export function findPoll(messageId: string) {
	return db.select().from(polls).where(eq(polls.messageId, messageId)).get();
}
