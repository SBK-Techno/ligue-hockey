import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { players } from '#lib/domain/players/schema.ts';
import {
	chatMessages,
	pollOptions,
	pollVotes,
	polls,
	type ChatMessageRow
} from './schema.ts';

/**
 * Un message porte l'identité visuelle de son auteur, même quand ce dernier
 * n'a pas de fiche de joueur : le compte suffit, la fiche ajoute le chandail
 * et la position. La jointure est donc à gauche.
 */
export type MessageRow = ChatMessageRow & {
	authorName: string;
	authorAvatarId: string | null;
	authorJerseyNumber: number | null;
	authorPosition: (typeof players.$inferSelect)['position'] | null;
};

const messageColumns = {
	id: chatMessages.id,
	authorUserId: chatMessages.authorUserId,
	kind: chatMessages.kind,
	body: chatMessages.body,
	createdAt: chatMessages.createdAt,
	deletedAt: chatMessages.deletedAt,
	deletedBy: chatMessages.deletedBy,
	authorName: user.name,
	authorAvatarId: players.avatarId,
	authorJerseyNumber: players.jerseyNumber,
	authorPosition: players.position
} as const;

function messageQuery() {
	return db
		.select(messageColumns)
		.from(chatMessages)
		.innerJoin(user, eq(user.id, chatMessages.authorUserId))
		.leftJoin(players, eq(players.userId, chatMessages.authorUserId));
}

/**
 * La page précédente est strictement antérieure au curseur. L'identifiant
 * départage deux messages de la même milliseconde, puis l'ordre reste stable.
 */
export function listMessages(
	limit: number,
	before: { createdAt: number; id: string } | null
): MessageRow[] {
	return messageQuery()
		.where(
			before === null
				? undefined
				: or(
						lt(chatMessages.createdAt, before.createdAt),
						and(
							eq(chatMessages.createdAt, before.createdAt),
							lt(chatMessages.id, before.id)
						)
					)
		)
		.orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
		.limit(limit)
		.all();
}

/** Le dernier message visible, sans charger l'historique. */
export function listLatestVisibleMessage(): MessageRow | undefined {
	return messageQuery()
		.where(isNull(chatMessages.deletedAt))
		.orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
		.limit(1)
		.get();
}

/**
 * Pour l'accueil : seulement les sondages encore ouverts, du plus récent au
 * plus ancien. On ne charge jamais l'historique complet pour une seule carte.
 */
export function listOpenPollMessages(now: number, limit: number): MessageRow[] {
	return messageQuery()
		.innerJoin(polls, eq(polls.messageId, chatMessages.id))
		.where(
			and(
				isNull(chatMessages.deletedAt),
				or(isNull(polls.closesAt), gt(polls.closesAt, now))
			)
		)
		.orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
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
): boolean {
	return db.transaction((tx) => {
		const poll = tx
			.select({ closesAt: polls.closesAt })
			.from(polls)
			.where(eq(polls.messageId, messageId))
			.get();
		if (!poll || (poll.closesAt !== null && poll.closesAt <= createdAt)) {
			return false;
		}
		tx.insert(pollVotes)
			.values({ messageId, optionId, userId, createdAt })
			.onConflictDoUpdate({
				target: [pollVotes.messageId, pollVotes.userId],
				set: { optionId, createdAt }
			})
			.run();
		return true;
	});
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
