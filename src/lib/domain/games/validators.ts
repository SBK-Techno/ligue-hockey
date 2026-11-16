import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { GAME_WARNING_KEYS } from '#config/game-warnings.ts';
import { DATE_PATTERN, TIME_PATTERN } from '#config/time.ts';
import { isRealDate } from '#lib/shared/time/clock.ts';

export const GAME_LIMITS = {
	notesMax: 1000
} as const;

export const gameInputSchema = z.object({
	gameDate: z
		.string()
		.trim()
		.regex(DATE_PATTERN, 'invalid-date')
		.refine(isRealDate, 'invalid-date'),
	startTime: z.string().trim().regex(TIME_PATTERN, 'invalid-time'),
	locationId: z.string().trim().min(1),
	notes: z.preprocess(
		(value) => (value === '' || value === undefined ? null : value),
		z.string().trim().max(GAME_LIMITS.notesMax).nullable()
	)
});

export const generationSnapshotSchema = z.object({
	skillDiff: z.number().nullable(),
	ageDiff: z.number(),
	sizeDiff: z.number(),
	warnings: z.array(z.enum(GAME_WARNING_KEYS)),
	ruleViolations: z
		.array(
			z.object({
				ruleId: z.string().min(1),
				kind: z.enum(['must', 'must_not']),
				strict: z.boolean(),
				playerIds: z.tuple([z.string().min(1), z.string().min(1)])
			})
		)
		.default([]),
	bench: z.array(
		z.object({
			playerId: z.string().min(1),
			position: z.enum(POSITION_KEYS),
			kind: z.enum(['regular', 'sub'])
		})
	),
	candidateKey: z.string(),
	generatedAt: z.number().int()
});

export type GameInput = z.infer<typeof gameInputSchema>;
export type GenerationSnapshot = z.infer<typeof generationSnapshotSchema>;
