import { z } from 'zod';
import { GOAL_KIND_KEYS } from '#config/goal-kinds.ts';
import { INFRACTION_KEYS, PENALTY_MINUTES } from '#config/infractions.ts';
import { PERIOD_NUMBERS } from '#config/periods.ts';
import { TEAM_KEYS } from '#config/teams.ts';
import { isValidGameClock } from '#config/time.ts';

const clockSchema = z
	.string()
	.trim()
	.refine(isValidGameClock, 'invalid-clock');

const optionalPlayerId = z.preprocess(
	(value) =>
		value === undefined || value === null || value === '' ? null : value,
	z.string().trim().min(1).nullable()
);

const goalFields = {
	team: z.enum(TEAM_KEYS),
	period: z.number().int().min(1).max(4),
	clock: clockSchema,
	kind: z.enum(GOAL_KIND_KEYS),
	scorerPlayerId: z.string().trim().min(1),
	assist1PlayerId: optionalPlayerId,
	assist2PlayerId: optionalPlayerId
};

export const goalInputSchema = z
	.object(goalFields)
	.refine(
		(input) =>
			input.assist2PlayerId === null || input.assist1PlayerId !== null,
		{
			message: 'assist-order',
			path: ['assist2PlayerId']
		}
	)
	.refine(
		(input) =>
			input.kind !== 'penalty_shot' || input.assist1PlayerId === null,
		{
			message: 'penalty-shot-assists',
			path: ['assist1PlayerId']
		}
	)
	.refine(
		(input) =>
			input.kind !== 'penalty_shot' || input.assist2PlayerId === null,
		{
			message: 'penalty-shot-assists',
			path: ['assist2PlayerId']
		}
	);

export const penaltyInputSchema = z.object({
	team: z.enum(TEAM_KEYS),
	period: z.number().int().min(1).max(4),
	clock: clockSchema,
	playerId: z.string().trim().min(1),
	infraction: z.enum(INFRACTION_KEYS),
	minutes: z
		.number()
		.int()
		.refine(
			(value) => (PENALTY_MINUTES as readonly number[]).includes(value),
			'invalid-minutes'
		),
	coincidental: z.boolean()
});

export type GoalInput = z.infer<typeof goalInputSchema>;
export type PenaltyInput = z.infer<typeof penaltyInputSchema>;

/*
 * Forme de transport des mêmes contrats : un formulaire HTML envoie du texte.
 * La conversion vit ici, à côté du schéma métier, pour que les noms de champs
 * et les bornes aient un seul propriétaire.
 */
const periodField = z.coerce
	.number()
	.int()
	.refine(
		(value) => (PERIOD_NUMBERS as readonly number[]).includes(value),
		'invalid-period'
	);

const optionalPlayerField = z
	.string()
	.trim()
	.optional()
	.default('');

export const goalFormInputSchema = z.object({
	team: z.enum(TEAM_KEYS),
	period: periodField,
	clock: clockSchema,
	kind: z.enum(GOAL_KIND_KEYS),
	scorerPlayerId: z.string().trim().min(1),
	assist1PlayerId: optionalPlayerField,
	assist2PlayerId: optionalPlayerField
});

export const penaltyFormInputSchema = z.object({
	team: z.enum(TEAM_KEYS),
	period: periodField,
	clock: clockSchema,
	playerId: z.string().trim().min(1),
	infraction: z.enum(INFRACTION_KEYS),
	minutes: z.coerce
		.number()
		.int()
		.refine(
			(value) => (PENALTY_MINUTES as readonly number[]).includes(value),
			'invalid-minutes'
		),
	coincidental: z.preprocess(
		(value) => value === 'on' || value === 'true' || value === true,
		z.boolean()
	)
});
