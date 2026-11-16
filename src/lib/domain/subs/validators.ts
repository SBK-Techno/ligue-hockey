import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';

const positions = z.preprocess(
	(value) => (Array.isArray(value) ? value : [value]),
	z.array(z.enum(POSITION_KEYS)).min(1)
);

export const subProfileInputSchema = z.object({
	positions
});

export const subFavoriteInputSchema = z.object({
	playerId: z.string().trim().min(1),
	favorite: z.preprocess(
		(value) => value === 'on' || value === 'true' || value === true,
		z.boolean()
	)
});

export type SubProfileInput = z.infer<typeof subProfileInputSchema>;
