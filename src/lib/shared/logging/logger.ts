import { env } from '#lib/shared/config/env.ts';
import { clock, toDate } from '#lib/shared/time/clock.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40
};

const REDACTED = '[redacted]';
const SENSITIVE_KEY =
	/password|secret|token|cookie|authorization|vapid|smtp|session/i;

export function redactPath(path: string): string {
	return path.replace(/^(\/api\/auth\/reset-password\/)[^/]+/, '$1[redacted]');
}

function sanitize(value: unknown, seen: WeakSet<object>, depth = 0): unknown {
	if (depth > 5) return '[depth]';
	if (value === null || value === undefined) return value;
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: env.isProduction ? undefined : value.stack
		};
	}
	if (typeof value === 'bigint') return value.toString();
	if (typeof value !== 'object') return value;
	if (seen.has(value)) return '[circular]';
	seen.add(value);

	if (Array.isArray(value)) {
		return value.map((entry) => sanitize(entry, seen, depth + 1));
	}

	const output: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		output[key] = SENSITIVE_KEY.test(key)
			? REDACTED
			: sanitize(entry, seen, depth + 1);
	}
	return output;
}

function write(level: LogLevel, event: string, fields: Fields): void {
	if (ORDER[level] < ORDER[env.logLevel]) return;

	const record = {
		ts: toDate(clock.nowMs()).toISOString(),
		level,
		event,
		...(sanitize(fields, new WeakSet()) as Fields)
	};

	process.stdout.write(`${JSON.stringify(record)}\n`);
}

export type Logger = {
	debug: (event: string, fields?: Fields) => void;
	info: (event: string, fields?: Fields) => void;
	warn: (event: string, fields?: Fields) => void;
	error: (event: string, fields?: Fields) => void;
	child: (bindings: Fields) => Logger;
};

function createLogger(bindings: Fields): Logger {
	const emit =
		(level: LogLevel) =>
		(event: string, fields: Fields = {}) =>
			write(level, event, { ...bindings, ...fields });

	return {
		debug: emit('debug'),
		info: emit('info'),
		warn: emit('warn'),
		error: emit('error'),
		child: (childBindings) => createLogger({ ...bindings, ...childBindings })
	};
}

export const logger = createLogger({});
