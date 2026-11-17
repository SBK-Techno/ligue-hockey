import { error as httpError, fail, json } from '@sveltejs/kit';
import type { I18nKey } from '#config/i18n/fr.ts';
import { isAppError } from '#lib/shared/errors.ts';
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
