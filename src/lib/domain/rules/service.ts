import { ruleModeDefinition, ruleModeFor, type RuleMode } from '#config/rule-modes.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { regenerateUpcomingGeneratedGames } from '#lib/domain/games/upcoming.ts';
import { getPlayer } from '#lib/domain/players/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { newId } from '#lib/shared/ids/id.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { parseSchema } from '#lib/shared/validation.ts';
import { deletePairRule, findPairRule, insertPairRule, listPairRules } from './queries.ts';
import { pairRuleInputSchema, type PairRuleInput } from './validators.ts';

export type PairRuleView = {
	id: string;
	playerAId: string;
	playerBId: string;
	mode: RuleMode;
};

function normalize(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

export function listRules(actor: Actor): PairRuleView[] {
	requirePermission(actor, 'manageRules');
	return listPairRules().map((row) => ({
		id: row.id,
		playerAId: row.playerAId,
		playerBId: row.playerBId,
		mode: ruleModeFor(row.kind, row.strict)
	}));
}

export function createRule(actor: Actor, input: PairRuleInput): PairRuleView {
	requirePermission(actor, 'manageRules');
	const parsed = parseSchema(pairRuleInputSchema, input);

	getPlayer(actor, parsed.playerAId);
	getPlayer(actor, parsed.playerBId);

	const [playerAId, playerBId] = normalize(parsed.playerAId, parsed.playerBId);
	if (playerAId === playerBId) {
		throw new AppError('VALIDATION', { key: 'admin.ruleSelf' });
	}
	const mode = ruleModeDefinition(parsed.mode);
	if (!mode) {
		throw new AppError('VALIDATION', { key: 'admin.ruleModeUnknown' });
	}
	const existing = findPairRule(playerAId, playerBId);
	if (existing) {
		throw new AppError('CONFLICT', { key: 'admin.ruleExists' });
	}

	const id = newId('rule');
	insertPairRule({
		id,
		playerAId,
		playerBId,
		kind: mode.kind,
		strict: mode.strict,
		createdAt: clock.nowMs(),
		createdBy: actor.kind === 'user' ? actor.userId : null
	});
	recordAudit(actor, {
		action: 'rule.create',
		entityType: 'pair_rule',
		entityId: id,
		metadata: { playerAId, playerBId, mode: parsed.mode }
	});
	regenerateUpcomingGeneratedGames();

	return { id, playerAId, playerBId, mode: parsed.mode };
}

export function deleteRule(actor: Actor, id: string): void {
	requirePermission(actor, 'manageRules');
	deletePairRule(id);
	recordAudit(actor, {
		action: 'rule.delete',
		entityType: 'pair_rule',
		entityId: id
	});
	regenerateUpcomingGeneratedGames();
}
