export type ResetMode = 'invite' | 'reset';

/**
 * La même page sert l'invitation et la réinitialisation. Le mode vient de
 * l'adresse, jamais d'une supposition : les deux parcours n'ont pas le même
 * texte ni le même message de réussite.
 */
export function resetMode(value: string | null | undefined): ResetMode {
	return value === 'invite' ? 'invite' : 'reset';
}

export function resetSuccessPath(mode: ResetMode): string {
	return `/connexion?reinitialise=1&mode=${mode}`;
}

export function resetTitleKey(mode: ResetMode) {
	return mode === 'invite' ? 'invite.title' : 'auth.reset.chooseTitle';
}

export function resetLeadKey(mode: ResetMode) {
	return mode === 'invite' ? 'invite.lead' : 'auth.reset.chooseLead';
}

export function resetSuccessKey(mode: ResetMode) {
	return mode === 'invite' ? 'invite.success' : 'auth.reset.success';
}
