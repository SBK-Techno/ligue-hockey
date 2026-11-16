import { z } from 'zod';
import { PLAYER_LIMITS } from '#config/players.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { checkboxToBoolean } from '#lib/shared/validation.ts';

const name = z.string().trim().min(1).max(PLAYER_LIMITS.nameMax);
const age = z.coerce
	.number()
	.int()
	.min(PLAYER_LIMITS.ageMin)
	.max(PLAYER_LIMITS.ageMax);

export const invitePlayerSchema = z.object({
	firstName: name,
	lastName: name,
	email: z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.email().max(PLAYER_LIMITS.emailMax)),
	position: z.enum(POSITION_KEYS),
	age,
	isSubstitute: z.preprocess(
		(value) => (value === undefined ? false : checkboxToBoolean(value)),
		z.boolean()
	)
});

export const updateOwnProfileSchema = z.object({
	firstName: name,
	lastName: name,
	age
});

export const adminUpdatePlayerSchema = z.object({
	firstName: name.optional(),
	lastName: name.optional(),
	age: age.optional(),
	position: z.enum(POSITION_KEYS).optional(),
	isSubstitute: z
		.preprocess(
			(value) => (value === undefined ? undefined : checkboxToBoolean(value)),
			z.boolean().optional()
		)
		.optional(),
	active: z
		.preprocess(
			(value) => (value === undefined ? undefined : checkboxToBoolean(value)),
			z.boolean().optional()
		)
		.optional()
});

export type InvitePlayerInput = z.infer<typeof invitePlayerSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type AdminUpdatePlayerInput = z.infer<typeof adminUpdatePlayerSchema>;
