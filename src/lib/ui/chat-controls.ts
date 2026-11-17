import { t } from '#lib/shared/i18n/index.ts';

/** Le texte qui distingue un message d'un autre dans le nom de ses commandes. */
const EXCERPT_MAX = 48;

export type ChatControlTarget =
	| { kind: 'message'; author: string; body: string | null; question?: string | null }
	| { kind: 'pollOption'; index: number };

function messageExcerpt(target: Extract<ChatControlTarget, { kind: 'message' }>): string {
	const text = (target.question ?? target.body ?? '').replace(/\s+/g, ' ').trim();
	if (!text) return '';
	const characters = Array.from(text);
	return characters.length > EXCERPT_MAX
		? `${characters.slice(0, EXCERPT_MAX - 1).join('')}…`
		: text;
}

/**
 * Un seul propriétaire du nom accessible des commandes de discussion : le
 * message se nomme par son auteur et son extrait, le choix de sondage par son
 * numéro. Deux menus du même écran ne partagent donc jamais le même nom.
 */
export function chatControlName(target: ChatControlTarget): string {
	if (target.kind === 'pollOption') {
		return t('chat.optionDelete', { number: target.index + 1 });
	}
	const excerpt = messageExcerpt(target);
	return excerpt
		? t('chat.messageActionsName', { author: target.author, excerpt })
		: t('chat.messageActionsAuthor', { author: target.author });
}
