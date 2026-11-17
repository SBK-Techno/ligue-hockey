// @vitest-environment happy-dom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddressField from './AddressField.svelte';
import { t } from '#lib/shared/i18n/index.ts';

type Component = ReturnType<typeof mount>;

function payload(label: string): Response {
	return new Response(
		JSON.stringify({
			results: [
				{ id: `N:${label}`, label, mapUrl: 'https://example.test/carte' }
			]
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
}

let component: Component | undefined;

function input(): HTMLInputElement {
	const element = document.querySelector<HTMLInputElement>('input[name="address"]');
	if (!element) throw new Error('champ adresse absent');
	return element;
}

function hidden(): HTMLInputElement {
	const element = document.querySelector<HTMLInputElement>('input[name="mapUrl"]');
	if (!element) throw new Error('champ carte absent');
	return element;
}

function type(value: string): void {
	const field = input();
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
	flushSync();
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	if (component) unmount(component);
	component = undefined;
	document.body.replaceChildren();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('recherche pendant la saisie', () => {
	it('choisit une adresse et remplit le lien caché', async () => {
		const mapUrl =
			'https://www.openstreetmap.org/?mlat=46.34320&mlon=-72.54710#map=17/46.34320/-72.54710';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						results: [
							{
								id: 'N:42',
								label: '845 Boulevard des Estacades, Trois-Rivières',
								mapUrl
							}
						]
					}),
					{ status: 200, headers: { 'content-type': 'application/json' } }
				)
			)
		);

		component = mount(AddressField, { target: document.body, props: { id: 'adresse' } });
		type('845 boulevard');
		await vi.advanceTimersByTimeAsync(250);
		flushSync();

		const option = document.querySelector('[role="option"] button');
		expect(option?.textContent?.trim()).toBe(
			'845 Boulevard des Estacades, Trois-Rivières'
		);

		option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		flushSync();

		expect(input().value).toBe('845 Boulevard des Estacades, Trois-Rivières');
		expect(hidden().value).toBe(mapUrl);
		expect(document.querySelector('[role="listbox"]')).toBeNull();
	});

	it('efface le lien caché dès que l’adresse est modifiée à la main', () => {
		component = mount(AddressField, {
			target: document.body,
			props: {
				id: 'adresse',
				value: '845 Boulevard des Estacades',
				mapUrl: 'https://example.test/carte'
			}
		});

		type('845 Boulevard des Estacades, local 2');

		expect(hidden().value).toBe('');
	});

	it('retire les anciennes propositions dès la nouvelle saisie', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(payload('845 Boulevard des Estacades'))
		);
		component = mount(AddressField, { target: document.body, props: { id: 'adresse' } });

		type('845');
		await vi.advanceTimersByTimeAsync(250);
		flushSync();
		expect(document.querySelector('[role="option"]')).not.toBeNull();

		type('845 boulevard');
		flushSync();

		expect(document.querySelector('[role="option"]')).toBeNull();
		expect(document.body.textContent).toContain(t('admin.addressSearching'));
	});

	it('ignore une réponse qui arrive après Échap', async () => {
		let release: ((response: Response) => void) | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				() =>
					new Promise<Response>((resolve) => {
						release = resolve;
					})
			)
		);
		component = mount(AddressField, { target: document.body, props: { id: 'adresse' } });

		type('845');
		await vi.advanceTimersByTimeAsync(250);
		flushSync();

		input().dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
		);
		flushSync();

		release?.(payload('Adresse tardive'));
		await vi.advanceTimersByTimeAsync(10);
		flushSync();

		expect(document.querySelector('[role="listbox"]')).toBeNull();
		expect(document.body.textContent).not.toContain('Adresse tardive');
	});

	it('efface le lien caché quand le formulaire est réinitialisé', async () => {
		const form = document.createElement('form');
		document.body.append(form);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(payload('845 Boulevard des Estacades'))
		);
		component = mount(AddressField, { target: form, props: { id: 'adresse' } });

		type('845');
		await vi.advanceTimersByTimeAsync(250);
		flushSync();
		document.querySelector<HTMLButtonElement>('[role="option"] button')?.click();
		flushSync();
		expect(hidden().value).not.toBe('');

		form.reset();
		flushSync();

		expect(input().value).toBe('');
		expect(hidden().value).toBe('');
	});
});
