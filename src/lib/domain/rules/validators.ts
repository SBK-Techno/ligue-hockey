import { z } from 'zod';
import { RULE_MODE_KEYS } from '#config/rule-modes.ts';

const playerId = z.string().trim().min(1);

export const pairRuleInputSchema = z.object({
	playerAId: playerId,
	playerBId: playerId,
	mode: z.enum(RULE_MODE_KEYS)
});

export const pairRuleDeleteSchema = z.object({
	id: z.string().trim().min(1)
});

export type PairRuleInput = z.infer<typeof pairRuleInputSchema>;
