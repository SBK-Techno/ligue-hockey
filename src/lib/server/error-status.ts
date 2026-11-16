export type ErrorKind = 'app' | 'framework' | 'validation' | 'unknown';

/**
 * SvelteKit transmet le statut des erreurs `app`, `framework` et `validation`.
 * Une `AppError` levée directement est une erreur inconnue pour SvelteKit, mais
 * porte son propre statut. Tout le reste est un 500.
 */
export function errorStatus(
	kind: ErrorKind,
	caughtStatus: number | undefined,
	appErrorStatus?: number
): number {
	if (kind === 'app' || kind === 'framework' || kind === 'validation') {
		return caughtStatus ?? 500;
	}
	return appErrorStatus ?? 500;
}
