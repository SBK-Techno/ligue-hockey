import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

describe('brouillon du nom affiché', () => {
	it('garde une copie locale liée au champ, pas la valeur du serveur', () => {
		expect(source).toContain("let displayName = $state(account?.name ?? '');");
		expect(source).toContain('bind:value={displayName}');
		expect(source).not.toContain('value={account.name}');
	});

	it('resynchronise par le même propriétaire sur les deux fiches', () => {
		expect(source.match(/onSuccess: syncIdentityDraft/g)).toHaveLength(2);
		expect(source.match(/function syncIdentityDraft\(\)/g)).toHaveLength(1);
		expect(source).toContain('if (!profile) displayName = account?.name ??');
	});
});
