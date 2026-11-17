import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '#lib/domain/auth/types.ts';
import type { IdentityProvider } from '#lib/domain/auth/identity.ts';

const providerCalls = {
	signIn: 0,
	changePassword: 0,
	requestPasswordReset: 0,
	resetPassword: 0
};

function provider(overrides: Partial<IdentityProvider> = {}): IdentityProvider {
	return {
		createUser: vi.fn(async () => ({ id: 'new' })),
		updateName: vi.fn(async () => undefined),
		deleteUser: vi.fn(async () => undefined),
		setAccountState: vi.fn(async () => undefined),
		revokeSessions: vi.fn(async () => undefined),
		requestPasswordReset: vi.fn(async () => {
			providerCalls.requestPasswordReset += 1;
		}),
		signIn: vi.fn(async () => {
			providerCalls.signIn += 1;
		}),
		signOut: vi.fn(async () => undefined),
		changePassword: vi.fn(async () => {
			providerCalls.changePassword += 1;
		}),
		resetPassword: vi.fn(async () => {
			providerCalls.resetPassword += 1;
		}),
		...overrides
	};
}

const { provideIdentity } = await import('./identity.ts');
const {
	changeOwnPassword,
	requestPasswordReset,
	resetPassword,
	safeRedirectPath,
	signIn
} = await import('./service.ts');
const { resetThrottle } = await import('#lib/server/security/throttle.ts');

const player: Actor = {
	kind: 'user',
	active: true,
	userId: 'player',
	name: 'Joueur',
	role: 'player'
};

const headers = new Headers();
const context = { address: '203.0.113.10', headers };

function wrongPassword(): never {
	throw Object.assign(new Error('invalid password'), { statusCode: 400 });
}

beforeEach(() => {
	resetThrottle();
	for (const key of Object.keys(providerCalls) as (keyof typeof providerCalls)[]) {
		providerCalls[key] = 0;
	}
	provideIdentity(provider());
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('connexion', () => {
	it('ne laisse jamais une rafale parallèle dépasser le plafond', async () => {
		const attempts = await Promise.all(
			Array.from({ length: 20 }, () =>
				signIn({ email: 'victime@example.test', password: 'mauvais' }, context).then(
					() => 'ok',
					(error: unknown) => (error as { code?: string }).code ?? 'erreur'
				)
			)
		);

		expect(providerCalls.signIn).toBe(5);
		expect(attempts.filter((outcome) => outcome === 'ok')).toHaveLength(5);
		expect(attempts.filter((outcome) => outcome === 'RATE_LIMITED')).toHaveLength(15);
	});

	it('donne un seau indépendant à chaque client derrière le même proxy', async () => {
		provideIdentity(
			provider({ signIn: vi.fn(async () => wrongPassword()) })
		);

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await expect(
				signIn({ email: 'victime@example.test', password: 'mauvais' }, {
					address: '198.51.100.4',
					headers
				})
			).rejects.toMatchObject({ key: 'auth.invalid' });
		}
		await expect(
			signIn({ email: 'victime@example.test', password: 'mauvais' }, {
				address: '198.51.100.4',
				headers
			})
		).rejects.toMatchObject({ key: 'auth.throttled' });

		// Un autre client peut encore tenter la même adresse courriel : le
		// premier ne peut pas verrouiller la victime à sa place.
		await expect(
			signIn({ email: 'victime@example.test', password: 'mauvais' }, {
				address: '198.51.100.5',
				headers
			})
		).rejects.toMatchObject({ key: 'auth.invalid' });
	});

	it('efface le compteur après une connexion réussie et garde la cible interne', async () => {
		await expect(
			signIn(
				{ email: 'Membre@Example.test ', password: 'secret', next: '//evil.test' },
				context
			)
		).resolves.toEqual({ next: '/' });
		await expect(
			signIn({ email: 'membre@example.test', password: 'secret', next: '/matchs' }, context)
		).resolves.toEqual({ next: '/matchs' });
	});

	it('nettoie les chemins de retour dangereux', () => {
		expect(safeRedirectPath('https://evil.test')).toBe('/');
		expect(safeRedirectPath('/\\evil.test')).toBe('/');
		expect(safeRedirectPath('/profil')).toBe('/profil');
	});
});

describe('changement de mot de passe', () => {
	it('réserve atomiquement et refuse au-delà du plafond', async () => {
		const change = vi.fn(async () => wrongPassword());
		provideIdentity(provider({ changePassword: change }));

		for (let attempt = 0; attempt < 5; attempt += 1) {
			await expect(
				changeOwnPassword(
					player,
					{ currentPassword: 'faux', newPassword: 'nouveau-secret', confirm: 'nouveau-secret' },
					headers
				)
			).rejects.toMatchObject({ key: 'profile.currentPasswordInvalid' });
		}
		await expect(
			changeOwnPassword(
				player,
				{ currentPassword: 'faux', newPassword: 'nouveau-secret', confirm: 'nouveau-secret' },
				headers
			)
		).rejects.toMatchObject({ key: 'auth.throttled' });
		expect(change).toHaveBeenCalledTimes(5);
	});

	it('refuse une confirmation différente et une politique trop courte', async () => {
		await expect(
			changeOwnPassword(
				player,
				{ currentPassword: 'actuel', newPassword: 'nouveau-secret', confirm: 'autre-secret' },
				headers
			)
		).rejects.toMatchObject({ key: 'invite.mismatch' });

		await expect(
			changeOwnPassword(
				player,
				{ currentPassword: 'actuel', newPassword: 'court', confirm: 'court' },
				headers
			)
		).rejects.toMatchObject({ code: 'VALIDATION' });
	});
});

describe('réinitialisation', () => {
	it('limite les demandes par client et par courriel', async () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await requestPasswordReset({ email: 'membre@example.test' }, context);
		}
		await expect(
			requestPasswordReset({ email: 'membre@example.test' }, context)
		).rejects.toMatchObject({ key: 'auth.throttled' });
		expect(providerCalls.requestPasswordReset).toBe(3);
	});

	it('refuse un jeton expiré et une confirmation différente', async () => {
		provideIdentity(
			provider({
				resetPassword: vi.fn(async () => {
					providerCalls.resetPassword += 1;
					throw Object.assign(new Error('expired'), { statusCode: 400 });
				})
			})
		);

		await expect(
			resetPassword({ token: 'jeton', password: 'nouveau-secret', confirm: 'nouveau-secret' })
		).rejects.toMatchObject({ key: 'invite.expired' });

		await expect(
			resetPassword({ token: 'jeton', password: 'nouveau-secret', confirm: 'autre-secret' })
		).rejects.toMatchObject({ key: 'invite.mismatch' });
	});
});
