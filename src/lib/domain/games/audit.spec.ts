import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import { ratingsRemovedAudit } from './audit.ts';

const manager: Actor = {
	kind: 'user',
	active: true,
	userId: 'manager',
	name: 'Gérant',
	role: 'manager'
};

describe('trace de purge des notes de match', () => {
	it.each<[string, string[]]>([
		['aucun joueur', []],
		['un joueur', ['a']],
		['plusieurs joueurs', ['a', 'b']]
	])('%s : même action et même métadonnée', (_label, playerIds) => {
		const entry = ratingsRemovedAudit(manager, 'game', playerIds);

		expect(entry).toMatchObject({
			actorUserId: 'manager',
			action: 'ratings.game_removed',
			entityType: 'game',
			entityId: 'game'
		});
		expect(JSON.parse(entry.metadataJson!)).toEqual({ playerIds });
	});

	it('garde un seul constructeur pour les trois chemins', () => {
		const entry = ratingsRemovedAudit(manager, 'game', []);
		expect(entry.action).toBe('ratings.game_removed');

		for (const file of ['alignment.ts', 'lineup.ts', 'service.ts']) {
			const source = readFileSync(new URL(file, import.meta.url), 'utf8');
			expect(source, file).toContain(
				'ratingsRemovedAudit(actor, gameId, playerIds)'
			);
			expect(source, file).not.toContain("'ratings.game_removed'");
		}

		const builder = readFileSync(new URL('./audit.ts', import.meta.url), 'utf8');
		expect(builder.match(/ratings\.game_removed/g)).toHaveLength(1);
	});
});
