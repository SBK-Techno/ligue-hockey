import type { z } from 'zod';
import { AppError } from '#lib/shared/errors.ts';

export function checkboxToBoolean(value: unknown): boolean {
	return value === 'on' || value === 'true' || value === true;
}

export function parseSchema<T>(schema: z.ZodType<T>, input: unknown): T {
	const result = schema.safeParse(input);
	if (!result.success) {
		throw new AppError('VALIDATION', {
			details: result.error.issues.map((issue) => ({
				path: issue.path.join('.'),
				code: issue.code
			}))
		});
	}
	return result.data;
}

export function formToObject(
	formData: FormData
): Record<string, FormDataEntryValue | FormDataEntryValue[]> {
	const output: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
	for (const key of new Set(formData.keys())) {
		const values = formData.getAll(key);
		output[key] = values.length > 1 ? values : values[0];
	}
	return output;
}

export function parseForm<T>(schema: z.ZodType<T>, formData: FormData): T {
	return parseSchema(schema, formToObject(formData));
}

export function parseSearchParams<T>(
	schema: z.ZodType<T>,
	url: URL
): T {
	return parseSchema(schema, Object.fromEntries(url.searchParams));
}
