import { randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
	return `${prefix}_${randomUUID()}`;
}

export function newToken(): string {
	return randomUUID();
}
