import { CONFIRM_REQUEST_EVENT } from './events.ts';

export type ConfirmTone = 'danger' | 'neutral';

export type ConfirmOptions = {
	title: string;
	question: string;
	confirmLabel: string;
	cancelLabel: string;
	tone: ConfirmTone;
};

export type ConfirmRequest = ConfirmOptions & {
	settle: (confirmed: boolean) => void;
};

/**
 * Demande une confirmation à l'hôte unique de la coquille. La promesse est
 * résolue par la boîte de dialogue; aucun formulaire ne monte la sienne.
 */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
	if (typeof window === 'undefined') return Promise.resolve(false);
	return new Promise((resolve) => {
		window.dispatchEvent(
			new CustomEvent(CONFIRM_REQUEST_EVENT, {
				detail: { ...options, settle: resolve }
			})
		);
	});
}
