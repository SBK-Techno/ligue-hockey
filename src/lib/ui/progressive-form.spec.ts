import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enhance } = vi.hoisted(() => ({ enhance: vi.fn() }));

vi.mock('$app/forms', () => ({ enhance }));

type FakeElement = { disabled: boolean };

function fakeNode() {
	const buttons: FakeElement[] = [{ disabled: false }];
	const fieldsets: FakeElement[] = [{ disabled: false }];
	const node = {
		buttons,
		fieldsets,
		setAttribute: vi.fn(),
		removeAttribute: vi.fn(),
		querySelectorAll: (selector: string) =>
			selector === 'button' ? buttons : selector === 'fieldset' ? fieldsets : []
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
		expect(node.buttons[0].disabled).toBe(true);

		const updateOptions = vi.fn(async () => {});
		await update({
			update: updateOptions,
			result: { type: 'success' }
		});

		expect(updateOptions).toHaveBeenCalledWith({ reset: false });
		expect(onSuccess).toHaveBeenCalledWith({ type: 'success' });
		expect(node.fieldsets[0].disabled).toBe(false);
		expect(node.buttons[0].disabled).toBe(false);
	});
});
