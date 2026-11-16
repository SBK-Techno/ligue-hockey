import { z } from 'zod';

const playerId = z.string().trim().min(1);

export const pairRuleInputSchema = z.object({
	playerAId: playerId,
	playerBId: playerId,
	kind: z.enum(['must', 'must_not'])
});

export const pairRuleDeleteSchema = z.object({
	id: z.string().trim().min(1)
});

export type PairRuleInput = z.infer<typeof pairRuleInputSchema>;
