import { enhance } from '$app/forms';

export type ProgressiveFormOptions = {
	/** Un formulaire de notes garde ses valeurs; le serveur reste la source. */
	reset?: boolean;
	onSuccess?: (result: { type: string }) => void;
};

/**
 * Progressive enhancement shared by every form: keeps SvelteKit's default
 * behaviour, blocks a second submit while one is in flight, disables the
 * fieldset, and exposes the pending state to assistive technology.
 */
export function progressiveForm(
	node: HTMLFormElement,
	options: ProgressiveFormOptions = {}
) {
	let pending = false;

	return enhance(node, ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}

		pending = true;
		node.setAttribute('aria-busy', 'true');
		const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>('button'));
		const wasDisabled = buttons.map((button) => button.disabled);
		const fieldsets = Array.from(node.querySelectorAll<HTMLFieldSetElement>('fieldset'));
		const fieldsetsWereDisabled = fieldsets.map((fieldset) => fieldset.disabled);
		const controls = Array.from(
			node.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
				'input, select, textarea'
			)
		);
		const controlsWereDisabled = controls.map((control) => control.disabled);
		for (const button of buttons) button.disabled = true;
		for (const fieldset of fieldsets) fieldset.disabled = true;
		for (const control of controls) control.disabled = true;

		return async ({ update, result }) => {
			try {
				await update({ reset: options.reset ?? true });
				if (result.type === 'success') options.onSuccess?.(result);
			} finally {
				pending = false;
				if (document.contains(node)) {
					node.removeAttribute('aria-busy');
					buttons.forEach((button, index) => {
						button.disabled = wasDisabled[index] ?? false;
					});
					fieldsets.forEach((fieldset, index) => {
						fieldset.disabled = fieldsetsWereDisabled[index] ?? false;
					});
					controls.forEach((control, index) => {
						control.disabled = controlsWereDisabled[index] ?? false;
					});
				}
				const closed = active?.closest('details:not([open])');
				if (active && !closed && document.contains(active)) {
					active.focus({ preventScroll: true });
				}
			}
		};
	});
}
