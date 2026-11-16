export type IdentityUserInput = {
	email: string;
	name: string;
	role: 'admin' | 'player';
	password: string;
};

export type IdentityProvider = {
	createUser(input: IdentityUserInput): Promise<{ id: string }>;
	deleteUser(userId: string): Promise<void>;
	requestPasswordReset(email: string): Promise<void>;
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
