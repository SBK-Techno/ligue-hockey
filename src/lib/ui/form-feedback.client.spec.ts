// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FormFeedback from './FormFeedback.svelte';

let component: ReturnType<typeof mount> | undefined;

function target(): HTMLElement {
	const node = document.createElement('div');
	document.body.append(node);
	return node;
}

function focusOutside(): HTMLButtonElement {
	const button = document.createElement('button');
	document.body.append(button);
	button.focus();
	return button;
}

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.innerHTML = '';
});

describe('focus de la rétroaction', () => {
	it('porte le focus sur le nouveau message quand focusOnChange est demandé', () => {
		const outside = focusOutside();
		component = mount(FormFeedback, {
			target: target(),
			props: {
				form: { ok: false, message: 'Erreur d’alignement', section: 'lineup' },
				section: 'lineup',
				focusOnChange: true
			}
		});
		flushSync();

		expect(outside.contains(document.activeElement)).toBe(false);
		expect(document.activeElement?.textContent?.trim()).toBe('Erreur d’alignement');
	});

	it('laisse le focus où il est sans focusOnChange', () => {
		const outside = focusOutside();
		component = mount(FormFeedback, {
			target: target(),
			props: {
				form: { ok: true, message: 'Enregistré', section: 'compte' },
				section: 'compte'
			}
		});
		flushSync();

		expect(document.activeElement).toBe(outside);
	});
});
