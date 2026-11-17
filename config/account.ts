export const ACCOUNT_LIMITS = {
	displayNameMax: 80,
	sessionListMax: 20,
	passwordMax: 128,
	unreadBadgeMax: 9
} as const;

export const AUTH_POLICY = {
	sessionRefreshHours: 24,
	passwordWindowSeconds: 3600
} as const;
