import { describe, expect, it } from 'vitest';
import { ROSTER_LIMITS } from '#config/roster.ts';
import { manualLineupInputSchema } from './validators.ts';
import { generationSnapshotSchema } from './validators.ts';

const legacySnapshot = {
	skillDiff: 0,
	ageDiff: 0,
	sizeDiff: 0,
	warnings: [],
	bench: [],
	candidateKey: '',
	generatedAt: 1_700_000_000_000
};

describe('generation snapshot', () => {
	it('parses a snapshot written before rule violations existed', () => {
		const parsed = generationSnapshotSchema.parse(legacySnapshot);
		expect(parsed.ruleViolations).toEqual([]);
	});

	it('rejects a violation with a missing player', () => {
		const result = generationSnapshotSchema.safeParse({
			...legacySnapshot,
			ruleViolations: [
				{ ruleId: 'r1', kind: 'must', strict: true, playerIds: ['a'] }
			]
		});
		expect(result.success).toBe(false);
	});
});

describe('bornes de l’alignement manuel', () => {
	const assignment = (slotIndex: number) => ({
		team: 'white' as const,
		position: 'forward' as const,
		slotIndex,
		playerId: null
	});

	it('accepte un index de place réel', () => {
		expect(
			manualLineupInputSchema.safeParse({
				expectedGeneratedAt: null,
				assignments: [assignment(ROSTER_LIMITS.maxSlotIndex)]
			}).success
		).toBe(true);
	});

	it('rejette un index absurde', () => {
		expect(
			manualLineupInputSchema.safeParse({
				expectedGeneratedAt: null,
				assignments: [assignment(ROSTER_LIMITS.maxSlotIndex + 1)]
			}).success
		).toBe(false);
	});

	it('rejette un tableau plus grand que le modèle maximal', () => {
		expect(
			manualLineupInputSchema.safeParse({
				expectedGeneratedAt: null,
				assignments: Array.from(
					{ length: ROSTER_LIMITS.maxAssignments + 1 },
					(_, index) => assignment(index % 8)
				)
			}).success
		).toBe(false);
	});
});
