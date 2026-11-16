import { z } from 'zod';
import {
	RATING_ATTRIBUTE_KEYS,
	RATING_SCALE,
	type RatingAttribute
} from '#config/rating-attributes.ts';

const value = z.coerce
	.number()
	.int()
	.min(RATING_SCALE.min)
	.max(RATING_SCALE.max);

/**
 * Les quatre notes de la ligue sont facultatives : une fiche partielle
 * enregistre seulement ce qui a été observé. Une clé absente est effacée,
 * jamais inventée.
 */
const optionalValue = value.optional();

export const ratingsInputSchema = z.object(
	Object.fromEntries(
		RATING_ATTRIBUTE_KEYS.map((key) => [key, optionalValue])
	) as { [K in RatingAttribute]: typeof optionalValue }
);

export type RatingsInput = z.infer<typeof ratingsInputSchema>;
