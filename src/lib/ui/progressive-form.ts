import { enhance } from '$app/forms';

/**
 * Progressive enhancement shared by every form: keeps SvelteKit's default
 * behaviour, blocks a second submit while one is in flight, and exposes the
 * pending state to assistive technology.
 */
export function progressiveForm(node: HTMLFormElement) {
	let pending = false;

	return enhance(node, ({ cancel }) => {
		if (pending) {
			cancel();
			return;
		}

		pending = true;
		node.setAttribute('aria-busy', 'true');
		const buttons = Array.from(node.querySelectorAll<HTMLButtonElement>('button'));
		const wasDisabled = buttons.map((button) => button.disabled);
		for (const button of buttons) button.disabled = true;

		return async ({ update }) => {
			try {
				await update();
			} finally {
				pending = false;
				node.removeAttribute('aria-busy');
				buttons.forEach((button, index) => {
					button.disabled = wasDisabled[index] ?? false;
				});
			}
		};
	});
}
