import type { GeneratorRule } from '#lib/domain/teams/generator.ts';
import { listPairRules } from './queries.ts';

export function rulesForGeneration(): GeneratorRule[] {
	return listPairRules().map((row) => ({
		id: row.id,
		playerAId: row.playerAId,
		playerBId: row.playerBId,
		kind: row.kind,
		strict: row.strict
	}));
}
