import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enhance } = vi.hoisted(() => ({ enhance: vi.fn() }));

vi.mock('$app/forms', () => ({ enhance }));

type FakeElement = { disabled: boolean };

function fakeNode() {
	const buttons: FakeElement[] = [{ disabled: false }];
	const fieldsets: FakeElement[] = [{ disabled: false }];
	const controls: FakeElement[] = [{ disabled: false }];
	const node = {
		buttons,
		fieldsets,
		controls,
		setAttribute: vi.fn(),
		removeAttribute: vi.fn(),
		querySelectorAll: (selector: string) =>
			selector === 'button'
				? buttons
				: selector === 'fieldset'
					? fieldsets
					: selector === 'input, select, textarea'
						? controls
						: []
	};
	return node;
}

describe('progressiveForm', () => {
	beforeEach(() => {
		enhance.mockReset();
		globalThis.HTMLElement = class {} as never;
		globalThis.document = {
			activeElement: null,
			contains: () => true
		} as never;
	});

	it('disables the fieldset during the request and restores it after', async () => {
		let submit: ((input: { cancel: () => void }) => Promise<unknown>) | undefined;
		enhance.mockImplementation((_node, callback) => {
			submit = callback;
			return {};
		});
		const node = fakeNode();
		const onSuccess = vi.fn();
		const { progressiveForm } = await import('./progressive-form.ts');

		progressiveForm(node as never, { reset: false, onSuccess });
		const update = (await submit?.({ cancel: vi.fn() })) as (input: {
			update: (options: { reset: boolean }) => Promise<void>;
			result: { type: string };
		}) => Promise<void>;

		expect(node.fieldsets[0].disabled).toBe(true);
		expect(node.controls[0].disabled).toBe(true);
		expect(node.buttons[0].disabled).toBe(true);

		const updateOptions = vi.fn(async () => {});
		await update({
			update: updateOptions,
			result: { type: 'success' }
		});

		expect(updateOptions).toHaveBeenCalledWith({ reset: false });
		expect(onSuccess).toHaveBeenCalledWith({ type: 'success' });
		expect(node.fieldsets[0].disabled).toBe(false);
		expect(node.controls[0].disabled).toBe(false);
		expect(node.buttons[0].disabled).toBe(false);
	});

	it.each([
		['par défaut', undefined, 1],
		['quand une rétroaction prend le focus', false, 0]
	] as const)('rend le focus au contrôle %s', async (_label, restoreFocus, calls) => {
		let submit: ((input: { cancel: () => void }) => Promise<unknown>) | undefined;
		enhance.mockImplementation((_node, callback) => {
			submit = callback;
			return {};
		});
		const focus = vi.fn();
		class Active {
			closest = () => null;
			focus = focus;
		}
		globalThis.HTMLElement = Active as never;
		globalThis.document = {
			activeElement: new Active(),
			contains: () => true
		} as never;
		const { progressiveForm } = await import('./progressive-form.ts');

		progressiveForm(fakeNode() as never, {
			reset: false,
			...(restoreFocus === undefined ? {} : { restoreFocus })
		});
		const update = (await submit?.({ cancel: vi.fn() })) as (input: {
			update: (options: { reset: boolean }) => Promise<void>;
			result: { type: string };
		}) => Promise<void>;

		await update({
			update: vi.fn(async () => {}),
			result: { type: 'success' }
		});

		expect(focus).toHaveBeenCalledTimes(calls);
	});
});
