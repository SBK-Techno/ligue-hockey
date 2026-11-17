import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

/**
 * Le contrat de déploiement : l'application ne peut pas compter par client si
 * le proxy n'est pas déclaré comme source de l'adresse. Ces deux variables
 * appartiennent au compose, pas à une route.
 */
const ROOT = new URL('../..', import.meta.url).pathname;

type Compose = {
	services: Record<string, { environment?: Record<string, string> }>;
};

function environment(): Record<string, string> {
	const doc = parse(readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8')) as Compose;
	return doc.services.ligue?.environment ?? {};
}

describe('contrat du proxy de déploiement', () => {
	it('déclare l’adresse client et la profondeur de confiance', () => {
		const env = environment();

		expect(env.ADDRESS_HEADER).toBe('X-Forwarded-For');
		expect(env.XFF_DEPTH).toBe('1');
	});
});
