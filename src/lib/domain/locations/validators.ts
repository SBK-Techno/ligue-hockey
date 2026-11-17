import { z } from 'zod';
import { settingBound } from '#config/settings-registry.ts';

export const LOCATION_LIMITS = {
	nameMax: settingBound('games.defaultLocation', 'max'),
	addressMax: 200,
	mapUrlMax: 500,
	notesMax: 2000
} as const;

const optionalText = (max: number) =>
	z.preprocess(
		(value) => (value === '' || value === undefined || value === null ? null : value),
		z.string().trim().max(max).nullable()
	);

const mapUrl = z.preprocess(
	(value) => (value === '' || value === undefined || value === null ? null : value),
	z
		.string()
		.trim()
		.max(LOCATION_LIMITS.mapUrlMax)
		.pipe(z.url({ protocol: /^https?$/ }))
		.nullable()
);

export const locationInputSchema = z.object({
	name: z.string().trim().min(1).max(LOCATION_LIMITS.nameMax),
	address: optionalText(LOCATION_LIMITS.addressMax),
	mapUrl,
	notes: optionalText(LOCATION_LIMITS.notesMax)
});

export const locationUpdateSchema = locationInputSchema.extend({
	id: z.string().trim().min(1)
});

export const locationDeleteSchema = z.object({
	id: z.string().trim().min(1)
});

export type LocationInput = z.infer<typeof locationInputSchema>;
