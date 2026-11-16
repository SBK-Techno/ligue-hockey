import { error as httpError, fail } from '@sveltejs/kit';
import type { I18nKey } from '#config/i18n/fr.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { t } from '#lib/shared/i18n/index.ts';

export type ActionMessage = {
	message: string;
	key?: I18nKey;
};

export function actionError(cause: unknown) {
	if (isAppError(cause)) {
		return fail(cause.status, {
			ok: false,
			message: t(cause.key, cause.params),
			key: cause.key
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
