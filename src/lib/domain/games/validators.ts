import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { DATE_PATTERN, TIME_PATTERN } from '#config/time.ts';
import { isRealDate } from '#lib/shared/time/clock.ts';

export const gameInputSchema = z.object({
	gameDate: z
		.string()
		.trim()
		.regex(DATE_PATTERN, 'invalid-date')
		.refine(isRealDate, 'invalid-date'),
	startTime: z.string().trim().regex(TIME_PATTERN, 'invalid-time'),
	location: z.string().trim().min(1).max(120),
	notes: z.preprocess(
		(value) => (value === '' || value === undefined ? null : value),
		z.string().trim().max(1000).nullable()
	)
});

export const generationSnapshotSchema = z.object({
	skillDiff: z.number(),
	ageDiff: z.number(),
	sizeDiff: z.number(),
	warnings: z.array(z.string()),
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
