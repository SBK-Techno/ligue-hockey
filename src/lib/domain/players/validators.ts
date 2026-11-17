import { z } from 'zod';
import { AVATAR_IDS } from '#config/avatars.ts';
import { PLAYER_LIMITS } from '#config/players.ts';
import { POSITION_KEYS } from '#config/positions.ts';
import { checkboxToBoolean } from '#lib/shared/validation.ts';

const name = z.string().trim().min(1).max(PLAYER_LIMITS.nameMax);
const age = z.coerce.number().int().min(PLAYER_LIMITS.ageMin).max(PLAYER_LIMITS.ageMax);

const playerIdSchema = z.string().trim().min(1);
const avatarId = z.enum(AVATAR_IDS);

export const playerIdInputSchema = z.object({
	playerId: playerIdSchema
});

const jersey = z.preprocess(
	(value) => (value === undefined || value === null || value === '' ? null : value),
	z.coerce.number().int().min(PLAYER_LIMITS.jerseyMin).max(PLAYER_LIMITS.jerseyMax).nullable()
);

const optionalJersey = z.preprocess(
	(value) => (value === undefined ? undefined : value === null || value === '' ? null : value),
	z.coerce
		.number()
		.int()
		.min(PLAYER_LIMITS.jerseyMin)
		.max(PLAYER_LIMITS.jerseyMax)
		.nullable()
		.optional()
);

export const invitePlayerSchema = z.object({
	firstName: name,
	lastName: name,
	email: z.string().trim().toLowerCase().pipe(z.email().max(PLAYER_LIMITS.emailMax)),
	position: z.enum(POSITION_KEYS),
	age,
	jerseyNumber: optionalJersey,
	isSubstitute: z.preprocess(
		(value) => (value === undefined ? false : checkboxToBoolean(value)),
		z.boolean()
	)
});

export const updateOwnProfileSchema = z.object({
	firstName: name,
	lastName: name,
	age,
	position: z.enum(POSITION_KEYS),
	jerseyNumber: jersey,
	avatarId: avatarId.optional()
});

export const adminUpdatePlayerSchema = z.object({
	firstName: name.optional(),
	lastName: name.optional(),
	age: age.optional(),
	position: z.enum(POSITION_KEYS).optional(),
	jerseyNumber: optionalJersey,
	avatarId: avatarId.optional(),
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
