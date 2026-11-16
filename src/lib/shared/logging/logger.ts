import { env } from '#lib/shared/config/env.ts';
import { clock, toDate } from '#lib/shared/time/clock.ts';
import { sanitize } from './redact.ts';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40
};

function write(level: LogLevel, event: string, fields: Fields): void {
	if (ORDER[level] < ORDER[env.logLevel]) return;

	const record = {
		ts: toDate(clock.nowMs()).toISOString(),
		level,
		event,
		...(sanitize(fields, !env.isProduction) as Fields)
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
