export type FormResult = {
	ok?: boolean;
	message?: string;
	section?: string;
	field?: string;
} | null;

/**
 * Une rétroaction appartient à une section : six formulaires sur une page ne
 * doivent pas afficher leur message au même endroit.
 */
export function feedbackFor(form: FormResult, section?: string): FormResult {
	if (!form) return null;
	if (!section) return form;
	return form.section === section ? form : null;
}

/** Le message d'une erreur de champ, seulement pour le champ qui l'a causée. */
export function fieldErrorFor(
	form: FormResult,
	section: string,
	field: string
): string | null {
	if (!form || form.ok !== false) return null;
	if (form.section !== section || form.field !== field) return null;
	return form.message ?? null;
}
