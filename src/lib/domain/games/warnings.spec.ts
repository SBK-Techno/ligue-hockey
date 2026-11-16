import { describe, expect, it } from 'vitest';
import { fr } from '#config/i18n/fr.ts';
import {
	GAME_WARNINGS,
	GAME_WARNING_KEYS,
	gameWarningDefinition,
	gameWarningLabelKey,
	isGameWarning,
	type GameWarningDefinition
} from '#config/game-warnings.ts';
import { generateTeams, type GeneratorPlayer, type GeneratorRule } from '#lib/domain/teams/generator.ts';
import { generationSnapshotSchema } from './validators.ts';

const definitions: readonly GameWarningDefinition[] = GAME_WARNINGS;

function player(
	id: string,
	overall = 3,
	age = 30
): GeneratorPlayer {
	return { id, position: 'forward', overall, age, kind: 'regular' };
}

const template = { forwardsPerTeam: 2, defensePerTeam: 0, goaliesPerTeam: 0 };

function warningsFor(
	players: GeneratorPlayer[],
	rules: GeneratorRule[] = [],
	limits = { skill: 0, age: 0, size: 0 }
): string[] {
	return generateTeams({
		players,
		template,
		rules,
		skillTolerance: 0.25,
		maxPlayers: 24,
		limits
	}).warnings;
}

describe('game warning registry', () => {
	it('declares one unique key per warning', () => {
		const keys = GAME_WARNINGS.map((warning) => warning.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(GAME_WARNING_KEYS).toEqual(keys);
	});

	it.each(definitions.map((warning) => [warning.key, warning] as const))(
		'resolves a French label for %s',
		(key, warning) => {
			expect(isGameWarning(key)).toBe(true);
			expect(gameWarningDefinition(key)).toBe(warning);
			expect(gameWarningLabelKey(key)).toBe(warning.labelKey);
			expect(typeof fr[warning.labelKey]).toBe('string');
			if (warning.helpKey) expect(typeof fr[warning.helpKey]).toBe('string');
			if (warning.playerHelpKey) expect(typeof fr[warning.playerHelpKey]).toBe('string');
		}
	);

	it('covers every warning the generator can produce', () => {
		const produced = new Set<string>([
			...warningsFor([player('a'), player('b')]),
			...warningsFor([player('a')]),
			...warningsFor(
				[player('a'), player('b')],
				[{ id: 'hard', playerAId: 'a', playerBId: 'b', kind: 'must' }]
			),
			...warningsFor(
				[player('a'), player('b')],
				[
					{
						id: 'soft',
						playerAId: 'a',
						playerBId: 'b',
						kind: 'must',
						strict: false
					}
				]
			),
			...warningsFor(
				[player('a', 3, 20), player('b', 3, 20), player('c', 3, 20), player('d', 3, 40)],
				[],
				{ skill: 0, age: 1, size: 0 }
			)
		]);

		for (const warning of produced) {
			expect(isGameWarning(warning)).toBe(true);
		}
		expect(produced).toContain('rule-limit');
	});

	it('rejects an unknown warning in a stored snapshot', () => {
		const snapshot = {
			skillDiff: 0,
			ageDiff: 0,
			sizeDiff: 0,
			warnings: ['typo-warning'],
			ruleViolations: [],
			bench: [],
			candidateKey: '',
			generatedAt: 1
		};

		expect(generationSnapshotSchema.safeParse(snapshot).success).toBe(false);
	});

	it('accepts every registered warning in a stored snapshot', () => {
		const snapshot = {
			skillDiff: 0,
			ageDiff: 0,
			sizeDiff: 0,
			warnings: [...GAME_WARNING_KEYS],
			ruleViolations: [],
			bench: [],
			candidateKey: '',
			generatedAt: 1
		};

		expect(generationSnapshotSchema.safeParse(snapshot).success).toBe(true);
	});
});
