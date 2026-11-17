import { error as httpError, fail, json } from '@sveltejs/kit';
import type { I18nKey } from '#config/i18n/fr.ts';
import { AppError, isAppError } from '#lib/shared/errors.ts';
import { t } from '#lib/shared/i18n/index.ts';
import { logger } from '#lib/shared/logging/logger.ts';

export type ActionMessage = {
	message: string;
	key?: I18nKey;
};

export function actionError(
	cause: unknown,
	extra: Record<string, unknown> = {}
) {
	if (isAppError(cause)) {
		return fail(cause.status, {
			ok: false,
			message: t(cause.key, cause.params),
			key: cause.key,
			...extra
		});
	}
	throw cause;
}

/**
 * Le premier champ refusé d'une erreur de validation, ou null. Les routes
 * l'utilisent pour ramener le focus au bon contrôle; elles ne relisent jamais
 * la forme des détails.
 */
export function failingField(cause: unknown): string | null {
	if (!isAppError(cause)) return null;
	const details = cause.details as Array<{ path?: string }> | undefined;
	return details?.find((entry) => entry.path)?.path ?? null;
}

/**
 * Refuse une écriture au-delà du seau de membre sans casser le formulaire.
 * Une soumission enrichie reçoit un échec d'action SvelteKit; une soumission
 * sans JavaScript reçoit une page courte et lisible; une API garde l'enveloppe
 * JSON commune. Un seul limiteur, une seule formulation.
 */
export function memberThrottleResponse(cause: AppError, request: Request): Response {
	const data = { ok: false, key: cause.key, message: t(cause.key, cause.params) };
	if (request.headers.get('x-sveltekit-action') === 'true') {
		return json(
			{ type: 'failure', status: cause.status, data },
			{ status: 200 }
		);
	}
	if (request.headers.get('accept')?.includes('text/html')) {
		return new Response(
			`<!doctype html><html lang="fr"><meta charset="utf-8"><title>${data.message}</title><p>${data.message}</p><p><a href="/">Retour</a></p></html>`,
			{
				status: cause.status,
				headers: { 'content-type': 'text/html; charset=utf-8' }
			}
		);
	}
	return apiError(cause);
}

export function loadError(cause: unknown): never {
	if (isAppError(cause)) {
		throw httpError(cause.status, t(cause.key, cause.params), { key: cause.key });
	}
	throw cause;
}

/**
 * La seule enveloppe d'erreur des routes JSON. Une route d'API ne renvoie
 * jamais un objet différent pour un refus : `ok`, `key` et `message` sont
 * toujours présents, quel que soit le consommateur.
 */
export function apiError(cause: unknown) {
	if (isAppError(cause)) {
		return json(
			{
				ok: false,
				key: cause.key,
				message: t(cause.key, cause.params)
			},
			{ status: cause.status }
		);
	}
	logger.error('api.unhandled_error', { error: cause });
	return json(
		{ ok: false, key: 'error.generic' as I18nKey, message: t('error.generic') },
		{ status: 500 }
	);
}
