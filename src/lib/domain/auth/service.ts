import { z } from 'zod';
import { identity } from '#lib/domain/auth/identity.ts';
import { parseSchema } from '#lib/shared/validation.ts';

const emailSchema = z.object({
	email: z.string().trim().toLowerCase().email().max(254)
});

export async function requestPasswordResetLink(input: unknown): Promise<void> {
	const parsed = parseSchema(emailSchema, input);
	await identity().requestPasswordReset(parsed.email, 'reset');
}
