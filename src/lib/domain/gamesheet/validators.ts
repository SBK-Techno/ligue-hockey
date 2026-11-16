import { z } from 'zod';
import { INFRACTION_KEYS, PENALTY_MINUTES } from '#config/infractions.ts';
import { TEAM_KEYS } from '#config/teams.ts';
import { isValidGameClock } from '#config/time.ts';
import { GOAL_KIND_KEYS } from './schema.ts';

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
