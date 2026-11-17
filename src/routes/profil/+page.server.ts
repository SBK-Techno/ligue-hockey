import { fail, type Actions, type ServerLoad } from '@sveltejs/kit';
import { z } from 'zod';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { PLAYER_LIMITS } from '#config/players.ts';
import { legendForIdentity } from '#config/identities.ts';
import { roleDefinition } from '#config/roles.ts';
import type { Position } from '#config/positions.ts';
import {
	changeOwnPassword,
	getOwnAccount,
	listOwnSessions,
	revokeOwnOtherSessions,
	updateOwnDisplayName
} from '#lib/domain/auth/service.ts';
import { managementTabs } from '#lib/domain/auth/destinations.ts';
import { can } from '#lib/domain/auth/policy.ts';
import { getMyBalance } from '#lib/domain/finance/service.ts';
import { seasonStatsFor } from '#lib/domain/gamesheet/season-stats.ts';
import {
	getNotificationPreferences,
	updateNotificationPreferences
} from '#lib/domain/notifications/service.ts';
import { notificationPreferencesSchema } from '#lib/domain/notifications/validators.ts';
import {
	findOwnProfile,
	getOwnAvatarPicker,
	updateOwnProfile
} from '#lib/domain/players/service.ts';
import { updateOwnProfileSchema } from '#lib/domain/players/validators.ts';
import { getMySubProfile, saveMySubProfile } from '#lib/domain/subs/service.ts';
import { subProfileInputSchema } from '#lib/domain/subs/validators.ts';
import { actionError, failingField } from '#lib/server/action.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';
import { formatCount, t } from '#lib/shared/i18n/index.ts';
import { formToObject, parseForm } from '#lib/shared/validation.ts';

const identitySchema = z.object({
	displayName: z.string().trim().min(1).max(ACCOUNT_LIMITS.displayNameMax)
});

export const load: ServerLoad = async ({ locals, parent }) => {
	const actor = locals.actor;
	const { isSubstitute } = await parent();
	const positions: Position[] = actor.kind === 'user' ? getMySubProfile(actor).positions : [];
	if (actor.kind !== 'user') {
		return {
			account: null,
			profile: null,
			avatarPicker: null,
			positions,
			notifications: { emailEnabled: true, pushEnabled: true },
			stats: null,
			isSubstitute: false,
			balance: null,
			sessions: [],
			currentSessionId: null,
			vapidPublicKey: publicEnv.vapidPublicKey,
			minLength: publicEnv.passwordMinLength,
			limits: {
				nameMax: PLAYER_LIMITS.nameMax,
				ageMin: PLAYER_LIMITS.ageMin,
				ageMax: PLAYER_LIMITS.ageMax,
				jerseyMin: PLAYER_LIMITS.jerseyMin,
				jerseyMax: PLAYER_LIMITS.jerseyMax,
				jerseyExample: PLAYER_LIMITS.jerseyExample
			},
			nav: {
				canViewAdmin: false,
				canSeeRatings: false,
				canManagePlayers: false,
				managementLinks: [],
				roleLabelKey: 'admin.role.player' as const
			},
			legend: null
		};
	}

	const account = getOwnAccount(actor);
	const profile = findOwnProfile(actor);
	const legend = legendForIdentity(profile?.avatarId);
	return {
		account,
		profile,
		avatarPicker: profile ? getOwnAvatarPicker(actor) : null,
		positions,
		notifications: getNotificationPreferences(actor),
		// Les chiffres du joueur seulement : aucune note ni habileté ne passe
		// par cette donnée, même pour un acteur autorisé à modifier les notes.
		stats: profile ? seasonStatsFor(profile.userId) : null,
		isSubstitute,
		balance: getMyBalance(actor),
		sessions: listOwnSessions(actor),
		currentSessionId: locals.sessionId,
		vapidPublicKey: publicEnv.vapidPublicKey,
		minLength: publicEnv.passwordMinLength,
		// Les bornes du formulaire sont lues une fois ici : la page ne charge
		// pas le module de configuration pour trois nombres.
		limits: {
			nameMax: PLAYER_LIMITS.nameMax,
			ageMin: PLAYER_LIMITS.ageMin,
			ageMax: PLAYER_LIMITS.ageMax,
			jerseyMin: PLAYER_LIMITS.jerseyMin,
			jerseyMax: PLAYER_LIMITS.jerseyMax,
			jerseyExample: PLAYER_LIMITS.jerseyExample
		},
		// Les capacités et les destinations sont résolues côté serveur : le
		// navigateur ne reçoit que les entrées déjà autorisées.
		nav: {
			canViewAdmin: can(actor, 'viewAdmin'),
			canSeeRatings: can(actor, 'editRatings'),
			canManagePlayers: can(actor, 'managePlayers'),
			managementLinks: managementTabs(actor),
			roleLabelKey: roleDefinition(account.role)?.labelKey ?? 'admin.role.player'
		},
		legend: legend ? { name: legend.name, number: legend.number, era: legend.era } : null
	};
};

const SECURITY = 'securite';

export const actions: Actions = {
	identity: async ({ request, locals }) => {
		try {
			if (findOwnProfile(locals.actor)) {
				return fail(403, {
					ok: false,
					section: 'compte',
					message: t('profile.playerNameManaged')
				});
			}
			const parsed = parseForm(identitySchema, await request.formData());
			const account = await updateOwnDisplayName(locals.actor, parsed);
			return {
				ok: true,
				section: 'compte',
				message: t('profile.identitySaved'),
				account
			};
		} catch (cause) {
			return actionError(cause, { section: 'compte' });
		}
	},
	profile: async ({ request, locals }) => {
		try {
			const parsed = parseForm(updateOwnProfileSchema, await request.formData());
			await updateOwnProfile(locals.actor, parsed);
			return { ok: true, section: 'joueur', message: t('profile.saved') };
		} catch (cause) {
			return actionError(cause, { section: 'joueur' });
		}
	},
	positions: async ({ request, locals }) => {
		try {
			const parsed = parseForm(subProfileInputSchema, await request.formData());
			saveMySubProfile(locals.actor, parsed);
			return { ok: true, section: 'positions', message: t('subs.profileSaved') };
		} catch (cause) {
			return actionError(cause, { section: 'positions' });
		}
	},
	notifications: async ({ request, locals }) => {
		try {
			const parsed = parseForm(notificationPreferencesSchema, await request.formData());
			updateNotificationPreferences(locals.actor, parsed);
			return { ok: true, section: 'notifications', message: t('profile.notificationsSaved') };
		} catch (cause) {
			return actionError(cause, { section: 'notifications' });
		}
	},
	sessions: async ({ locals }) => {
		try {
			const revoked = revokeOwnOtherSessions(locals.actor, locals.sessionId ?? '');
			return {
				ok: true,
				section: SECURITY,
				message:
					revoked === 0
						? t('profile.noOtherSessions')
						: formatCount(revoked, 'profile.sessionsRevoked.one', 'profile.sessionsRevoked.many')
			};
		} catch (cause) {
			return actionError(cause, { section: SECURITY });
		}
	},
	password: async ({ request, locals }) => {
		try {
			await changeOwnPassword(locals.actor, formToObject(await request.formData()), request.headers);
			return { ok: true, section: SECURITY, message: t('profile.passwordChanged') };
		} catch (cause) {
			return actionError(cause, {
				section: SECURITY,
				field: failingField(cause)
			});
		}
	}
};
