import { z } from 'zod';

export const CHAT_LIMITS = {
	messageMax: 10_000,
	questionMax: 200,
	optionMax: 120
} as const;

const option = z
	.string()
	.trim()
	.min(1)
	.max(CHAT_LIMITS.optionMax);

export const messageInputSchema = z.object({
	body: z.string().trim().min(1).max(CHAT_LIMITS.messageMax)
});

export const pollInputSchema = z.object({
	question: z.string().trim().min(1).max(CHAT_LIMITS.questionMax),
	options: z.preprocess(
		(value) => (Array.isArray(value) ? value : [value]),
		z.array(option).min(1).max(12)
	)
});

export const voteInputSchema = z.object({
	messageId: z.string().trim().min(1),
	optionId: z.string().trim().min(1)
});

export type PollInput = z.infer<typeof pollInputSchema>;
