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

export const ratingsInputSchema = z.object(
	Object.fromEntries(
		RATING_ATTRIBUTE_KEYS.map((key) => [key, value])
	) as { [K in RatingAttribute]: typeof value }
);

export type RatingsInput = z.infer<typeof ratingsInputSchema>;
