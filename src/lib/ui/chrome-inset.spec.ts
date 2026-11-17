import { afterEach, describe, expect, it, vi } from 'vitest';
import { publishChromeInset } from './chrome-inset.svelte.ts';

function fakeRoot() {
	const values = new Map<string, string>();
	return {
		values,
		style: {
			setProperty(name: string, value: string) {
				values.set(name, value);
			},
			removeProperty(name: string) {
				values.delete(name);
			}
		}
	};
}

function stubDocument(root: ReturnType<typeof fakeRoot>) {
	vi.stubGlobal('document', { documentElement: { style: root.style } });
}

afterEach(() => vi.unstubAllGlobals());

describe('décalage de chrome d’une surface', () => {
	it('publie la hauteur arrondie de la bande haute', () => {
		const root = fakeRoot();
		stubDocument(root);

		publishChromeInset('top', 60.6);

		expect(root.values.get('--surface-top-inset')).toBe('61px');
	});

	it('publie la bande basse sans toucher à la bande haute', () => {
		const root = fakeRoot();
		stubDocument(root);

		publishChromeInset('bottom', 74.4);

		expect(root.values.get('--surface-bottom-inset')).toBe('74px');
		expect(root.values.has('--surface-top-inset')).toBe(false);
	});

	it('retire l’appoint quand la surface disparaît ou ne mesure rien', () => {
		const root = fakeRoot();
		stubDocument(root);

		publishChromeInset('top', 61);
		publishChromeInset('top', 0);
		expect(root.values.has('--surface-top-inset')).toBe(false);

		publishChromeInset('bottom', 40);
		publishChromeInset('bottom', Number.NaN);
		expect(root.values.has('--surface-bottom-inset')).toBe(false);
	});

	it('ne dépend d’aucun document au rendu serveur', () => {
		expect(() => publishChromeInset('top', 61)).not.toThrow();
	});
});
