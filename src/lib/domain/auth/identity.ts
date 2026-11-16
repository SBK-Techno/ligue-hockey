export type IdentityUserInput = {
	email: string;
	name: string;
	role: 'admin' | 'player';
	password: string;
};

export type PasswordLinkPurpose = 'invitation' | 'reset';

export function passwordLinkPurpose(url: string): PasswordLinkPurpose {
	try {
		const callback = new URL(url).searchParams.get('callbackURL');
		if (!callback) return 'reset';
		return new URL(callback).searchParams.get('mode') === 'invitation'
			? 'invitation'
			: 'reset';
	} catch {
		return 'reset';
	}
}

export type IdentityProvider = {
	createUser(input: IdentityUserInput): Promise<{ id: string }>;
	deleteUser(userId: string): Promise<void>;
	requestPasswordReset(
		email: string,
		purpose: PasswordLinkPurpose
	): Promise<void>;
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
