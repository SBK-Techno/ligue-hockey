import type { ChatMessageView, ChatPollView } from '#lib/domain/chat/service.ts';

/**
 * La colonne des sondages montre les sondages encore ouverts d'abord, puis
 * les plus récents. Un sondage supprimé n'a plus de vue et disparaît de la
 * colonne; son message reste dans le fil comme pierre tombale.
 */
export type PollEntry = { message: ChatMessageView; poll: ChatPollView };

export function pollEntries(messages: readonly ChatMessageView[]): PollEntry[] {
	const entries: PollEntry[] = [];
	for (const message of messages) {
		if (message.deleted || !message.poll) continue;
		entries.push({ message, poll: message.poll });
	}
	return entries.sort((left, right) => {
		const leftClosed = left.poll.closed ? 1 : 0;
		const rightClosed = right.poll.closed ? 1 : 0;
		if (leftClosed !== rightClosed) return leftClosed - rightClosed;
		if (left.message.createdAt !== right.message.createdAt) {
			return right.message.createdAt - left.message.createdAt;
		}
		return right.message.id.localeCompare(left.message.id);
	});
}
