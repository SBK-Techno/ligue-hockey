import { fr } from '../config/i18n/fr.ts';

/**
 * Vérifie le registre de la copie française.
 *
 * La ligue tutoie toujours le membre et l'admin. Ce contrôle attrape les
 * rechutes vers le vouvoiement, les impératifs en -ez, les tirets cadratins
 * et les espaces réservés mal formés.
 */

const FORMAL_PRONOUN = /(?<!\p{L})(vous|votre|vos)(?!\p{L})/iu;
const SECOND_PERSON_PLURAL =
	/(?<!\p{L})(avez|êtes|serez|pouvez|devez|voulez|aurez|seriez|faites|allez|venez|savez|dites)(?!\p{L})/iu;
const IMPERATIVE_EZ = /(?<!\p{L})([a-zà-ÿ]{2,}ez)(?!\p{L})/giu;
const ALLOWED_EZ = new Set(['chez', 'nez', 'assez', 'rendez', 'rez', 'gaz', 'riz']);
const EM_DASH = '—';
const PLACEHOLDER = /\{([^}]*)\}/g;

const failures: string[] = [];

for (const [key, value] of Object.entries(fr)) {
	if (typeof value !== 'string' || value.length === 0) {
		failures.push(`${key}: valeur vide ou non textuelle`);
		continue;
	}
	if (FORMAL_PRONOUN.test(value)) {
		failures.push(`${key}: vouvoiement (${value})`);
	}
	if (SECOND_PERSON_PLURAL.test(value)) {
		failures.push(`${key}: deuxième personne du pluriel (${value})`);
	}
	for (const match of value.matchAll(IMPERATIVE_EZ)) {
		const word = match[1].toLowerCase();
		if (!ALLOWED_EZ.has(word)) {
			failures.push(`${key}: impératif en -ez « ${match[1]} »`);
		}
	}
	if (value.includes(EM_DASH)) {
		failures.push(`${key}: tiret cadratin`);
	}
	for (const match of value.matchAll(PLACEHOLDER)) {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(match[1])) {
			failures.push(`${key}: espace réservé invalide « ${match[0]} »`);
		}
	}
	const opened = (value.match(/\{/g) ?? []).length;
	const closed = (value.match(/\}/g) ?? []).length;
	if (opened !== closed) {
		failures.push(`${key}: accolades non balancées`);
	}
}

if (failures.length > 0) {
	for (const failure of failures) {
		console.error(`registre: ${failure}`);
	}
	process.exit(1);
}

console.log(`registre: ${Object.keys(fr).length} valeurs conformes`);
