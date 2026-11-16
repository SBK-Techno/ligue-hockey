import { auth } from '#lib/server/auth.ts';
import { env } from '#lib/shared/config/env.ts';
import type { IdentityProvider } from '#lib/domain/auth/identity.ts';

const RESET_PATH = '/reinitialiser-mot-de-passe';

export const betterAuthIdentity: IdentityProvider = {
	async createUser(input) {
		const result = await auth.api.createUser({
			body: {
				email: input.email,
				password: input.password,
				name: input.name,
				role: input.role
			}
		});
		return { id: result.user.id };
	},

	async deleteUser(userId) {
		const context = await auth.$context;
		await context.internalAdapter.deleteUser(userId);
	},

	async requestPasswordReset(email) {
		await auth.api.requestPasswordReset({
			body: {
				email,
				redirectTo: new URL(RESET_PATH, env.origin).toString()
			}
		});
	}
};
