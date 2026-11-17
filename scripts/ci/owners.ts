import { CHAT_PAGE_SIZE } from '#config/chat.ts';
import {
	FRAMEWORK_IMMUTABLE_CACHE,
	IMMUTABLE_CACHE,
	NO_CACHE,
	SHORT_CACHE
} from '../lib/static-cache.js';

/**
 * Les valeurs que le smoke de conteneur doit connaître sans les recopier.
 * Chaque réponse pointe vers son propriétaire : ajouter une valeur ici ne
 * crée pas un second owner, cela expose celui qui existe déjà.
 */
const VALUES: Record<string, string> = {
	'chat-page-size': String(CHAT_PAGE_SIZE),
	'cache-immutable': IMMUTABLE_CACHE,
	'cache-short': SHORT_CACHE,
	'cache-none': NO_CACHE,
	'cache-framework-immutable': FRAMEWORK_IMMUTABLE_CACHE
};

const [name] = process.argv.slice(2);
if (!name || !(name in VALUES)) {
	process.stderr.write(`valeur inconnue: ${name ?? '(aucune)'}\n`);
	process.exit(1);
}
process.stdout.write(VALUES[name]);
