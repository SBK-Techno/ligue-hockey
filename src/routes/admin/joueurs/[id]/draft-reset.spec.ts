import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('brouillons de la fiche joueur', () => {
	it('suit le joueur affiché quand la page reste montée entre deux joueurs', () => {
		// Kit garde le composant monté sur un changement de paramètre de la
		// même route : sans garde, le poste et le rôle choisis pour un joueur
		// fuiraient vers le suivant. Les brouillons sont réinitialisés par le
		// même propriétaire qui les crée, dès que l'identité change.
		expect(source).toContain('let draftPlayerId = player?.userId;');
		expect(source).toContain('const id = player?.userId;');
		expect(source).toContain('if (id === draftPlayerId) return;');
		expect(source).toContain('selectedRole = null;');
		expect(source).toContain('position = player?.position ?? null;');
	});
});
