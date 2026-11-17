/**
 * Le curseur de la discussion : un couple (date, identifiant) qui départage
 * deux messages écrits dans la même milliseconde. Un curseur invalide est
 * ignoré, jamais interprété comme une date arbitraire.
 */
export type ChatCursor = {
	createdAt: number;
	id: string;
};

export function encodeCursor(row: { createdAt: number; id: string }): string {
	return `${row.createdAt}:${row.id}`;
}

export function decodeCursor(value: string | null | undefined): ChatCursor | null {
	if (!value) return null;
	const separator = value.indexOf(':');
	if (separator <= 0) return null;
	const createdAt = Number(value.slice(0, separator));
	const id = value.slice(separator + 1);
	if (!Number.isSafeInteger(createdAt) || createdAt < 0 || id.length === 0) return null;
	return { createdAt, id };
}
