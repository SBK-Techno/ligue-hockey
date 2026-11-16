import type { I18nKey } from '#config/i18n/fr.ts';

export type AppErrorCode =
	| 'VALIDATION'
	| 'UNAUTHORIZED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'RATE_LIMITED'
	| 'INTERNAL';

const DEFAULTS: Record<
	AppErrorCode,
	{ status: number; key: I18nKey }
> = {
	VALIDATION: { status: 400, key: 'error.validation' },
	UNAUTHORIZED: { status: 401, key: 'error.sessionRequired' },
	FORBIDDEN: { status: 403, key: 'error.forbidden' },
	NOT_FOUND: { status: 404, key: 'error.notFound' },
	CONFLICT: { status: 409, key: 'error.conflict' },
	RATE_LIMITED: { status: 429, key: 'error.rateLimited' },
	INTERNAL: { status: 500, key: 'error.generic' }
};

export type ErrorParams = Record<string, string | number>;

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly status: number;
	readonly key: I18nKey;
	readonly params?: ErrorParams;
	readonly details?: unknown;

	constructor(
		code: AppErrorCode,
		options: {
			key?: I18nKey;
			params?: ErrorParams;
			message?: string;
			details?: unknown;
			cause?: unknown;
		} = {}
	) {
		super(options.message ?? code, { cause: options.cause });
		this.name = 'AppError';
		this.code = code;
		this.status = DEFAULTS[code].status;
		this.key = options.key ?? DEFAULTS[code].key;
		this.params = options.params;
		this.details = options.details;
	}
}

export function isAppError(value: unknown): value is AppError {
	return value instanceof AppError;
}

export function assert(
	condition: unknown,
	code: AppErrorCode,
	options?: { key?: I18nKey; message?: string; details?: unknown }
): asserts condition {
	if (!condition) {
		throw new AppError(code, options);
	}
}
