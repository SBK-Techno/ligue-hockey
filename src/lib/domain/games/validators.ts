import { z } from 'zod';
import { POSITION_KEYS } from '#config/positions.ts';
import { GAME_LIMITS } from '#config/games.ts';
import { GAME_WARNING_KEYS } from '#config/game-warnings.ts';
import { ROSTER_LIMITS } from '#config/roster.ts';
import { TEAM_KEYS, TEAMS } from '#config/teams.ts';
import { DATE_PATTERN, TIME_PATTERN } from '#config/time.ts';
import { isRealDate } from '#lib/shared/time/clock.ts';

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
			kind: z.enum(['regular', 'sub']),
			/** Absent des anciens instantanés : banc global, sans équipe. */
			team: z.enum(TEAM_KEYS).optional()
		})
	),
	candidateKey: z.string(),
	generatedAt: z.number().int()
});

export type GameInput = z.infer<typeof gameInputSchema>;

/**
 * Le formulaire d'édition transporte le jeton `updatedAt` qu'il a lu. Le
 * service ne le remplace jamais par une lecture fraîche : un formulaire
 * périmé doit perdre la course.
 */
export const updateGameInputSchema = gameInputSchema.extend({
	expectedUpdatedAt: z.coerce.number().int()
});

export type UpdateGameInput = z.infer<typeof updateGameInputSchema>;
export type GenerationSnapshot = z.infer<typeof generationSnapshotSchema>;

export const manualLineupInputSchema = z.object({
	/** Jeton de concurrence : génération lue par le gestionnaire, null si aucune. */
	expectedGeneratedAt: z.number().int().nullable(),
	/**
	 * Une formation complète : chaque place du modèle est envoyée, avec
	 * `null` pour une place vide. Le service compare les clés au modèle du
	 * match; un envoi partiel ne peut donc pas effacer l'alignement.
	 */
	assignments: z
		.array(
			z.object({
				team: z.enum(TEAM_KEYS),
				position: z.enum(POSITION_KEYS),
				slotIndex: z.number().int().min(0).max(ROSTER_LIMITS.maxSlotIndex),
				playerId: z.string().trim().min(1).nullable()
			})
		)
		.max(ROSTER_LIMITS.maxAssignments),
	/**
	 * Le banc habillé par équipe : chaque joueur envoyé habille le banc de son
	 * équipe. Absent ou vide, tout membre non aligné attend hors effectif,
	 * comme avant l'effectif par équipe.
	 */
	bench: z
		.array(
			z.object({
				playerId: z.string().trim().min(1),
				team: z.enum(TEAM_KEYS)
			})
		)
		.max(ROSTER_LIMITS.playersPerTeam * TEAMS.length)
		.default([])
});

export type ManualLineupInput = z.input<typeof manualLineupInputSchema>;
export type ManualLineupAssignment = ManualLineupInput['assignments'][number];
