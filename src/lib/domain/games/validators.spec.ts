import { describe, expect, it } from 'vitest';
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
