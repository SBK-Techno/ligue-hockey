export function redactPath(path: string): string {
	return path.replace(/^(\/api\/auth\/reset-password\/)[^/]+/, '$1[redacted]');
}
