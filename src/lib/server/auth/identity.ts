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

	async updateName(userId, name) {
		const context = await auth.$context;
		await context.internalAdapter.updateUser(userId, { name });
	},

	async setAccountState(userId, state) {
		const context = await auth.$context;
		await context.internalAdapter.updateUser(
			userId,
			state === 'inactive'
				? { banned: true, banReason: 'Compte désactivé' }
				: { banned: false, banReason: null, banExpires: null }
		);
	},

	async revokeSessions(userId) {
		// Better Auth's admin plugin revokes every session of a user through
		// this same adapter call (`dist/plugins/admin/routes.mjs`,
		// `revokeUserSessions`). The plugin endpoint requires an acting admin
		// session; the provider port is already called from an authorized use
		// case, so it uses the adapter directly.
		const context = await auth.$context;
		await context.internalAdapter.deleteUserSessions(userId);
	},

	async requestPasswordReset(email, purpose) {
		const target = new URL(RESET_PATH, env.origin);
		target.searchParams.set('mode', purpose);
		await auth.api.requestPasswordReset({
			body: {
				email,
				redirectTo: target.toString()
			}
		});
	},

	async signIn(credentials, headers) {
		await auth.api.signInEmail({
			body: {
				email: credentials.email,
				password: credentials.password
			},
			headers
		});
	},

	async changePassword(_userId, input, headers) {
		await auth.api.changePassword({
			body: {
				currentPassword: input.currentPassword,
				newPassword: input.newPassword,
				revokeOtherSessions: true
			},
			headers
		});
	},

	async resetPassword(input) {
		await auth.api.resetPassword({
			body: {
				newPassword: input.newPassword,
				token: input.token
			}
		});
	}
};
