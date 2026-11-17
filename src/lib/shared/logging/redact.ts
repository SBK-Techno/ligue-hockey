const REDACTED = '[redacted]';
const SENSITIVE_KEY =
	/password|secret|token|cookie|authorization|vapid|smtp|session/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TOKEN_URL = /https?:\/\/[^\s'"<>]*[A-Za-z0-9_-]{20,}[^\s'"<>]*/g;

/**
 * Une erreur de fournisseur peut citer une adresse ou un point de terminaison
 * poussé, qui est un secret porteur. Le message et la pile sont nettoyés au
 * même endroit que les champs sensibles, avant d'être stockés ou journalisés.
 */
export function redactText(text: string): string {
	return text.replace(EMAIL, REDACTED).replace(TOKEN_URL, REDACTED);
}

export function redactPath(path: string): string {
	return path.replace(/^(\/api\/auth\/reset-password\/)[^/]+/, '$1[redacted]');
}

function walk(
	value: unknown,
	seen: WeakSet<object>,
	includeStack: boolean,
	depth = 0
): unknown {
	if (depth > 5) return '[depth]';
	if (value === null || value === undefined) return value;
	if (value instanceof Error) {
		return {
			name: value.name,
			message: redactText(value.message),
			stack: includeStack && value.stack ? redactText(value.stack) : undefined
		};
	}
	if (typeof value === 'bigint') return value.toString();
	if (typeof value === 'string') return redactText(value);
	if (typeof value !== 'object') return value;
	if (seen.has(value)) return '[circular]';
	seen.add(value);

	if (Array.isArray(value)) {
		return value.map((entry) => walk(entry, seen, includeStack, depth + 1));
	}

	const output: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (SENSITIVE_KEY.test(key)) {
			output[key] = REDACTED;
		} else if (key === 'path' && typeof entry === 'string') {
			output[key] = redactPath(entry);
		} else {
			output[key] = walk(entry, seen, includeStack, depth + 1);
		}
	}
	return output;
}

export function sanitize(value: unknown, includeStack: boolean): unknown {
	return walk(value, new WeakSet(), includeStack);
}
