import type { Role } from '#config/roles.ts';

export type IdentityUserInput = {
	email: string;
	name: string;
	role: Role;
	password: string;
};

export type PasswordLinkPurpose = 'invitation' | 'reset';

export function passwordLinkPurpose(url: string): PasswordLinkPurpose {
	try {
		const callback = new URL(url).searchParams.get('callbackURL');
		if (!callback) return 'reset';
		return new URL(callback).searchParams.get('mode') === 'invitation' ? 'invitation' : 'reset';
	} catch {
		return 'reset';
	}
}

export type IdentityProvider = {
	createUser(input: IdentityUserInput): Promise<{ id: string }>;
	updateName(userId: string, name: string): Promise<void>;
	deleteUser(userId: string): Promise<void>;
	setRole(userId: string, role: IdentityUserInput['role']): Promise<void>;
	/**
	 * Refuse ou rouvre l'authentification d'un compte. Un compte inactif ne
	 * peut ni ouvrir de session, ni réinitialiser son mot de passe : l'état
	 * vit chez le fournisseur d'identité, pas seulement dans la fiche joueur.
	 */
	setAccountState(userId: string, state: 'active' | 'inactive'): Promise<void>;
	/** Ferme toutes les sessions d'un compte, sans supprimer le compte. */
	revokeSessions(userId: string): Promise<void>;
	requestPasswordReset(email: string, purpose: PasswordLinkPurpose): Promise<void>;
};

let provider: IdentityProvider | null = null;

export function provideIdentity(next: IdentityProvider): void {
	provider = next;
}

export function identity(): IdentityProvider {
	if (!provider) {
		throw new Error('Identity provider is not configured');
	}
	return provider;
}
