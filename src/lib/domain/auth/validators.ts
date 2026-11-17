import { z } from 'zod';
import { ACCOUNT_LIMITS } from '#config/account.ts';
import { PLAYER_LIMITS } from '#config/players.ts';
import { publicEnv } from '#lib/shared/config/public-env.ts';

/**
 * La seule déclaration des champs d'authentification. Les routes ne
 * redéfinissent ni le courriel ni les bornes du mot de passe : elles passent
 * le formulaire à ce module, qui le valide une fois pour tous les parcours.
 */
export const emailField = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.email().max(PLAYER_LIMITS.emailMax));

export const currentPasswordField = z
	.string()
	.min(1)
	.max(ACCOUNT_LIMITS.passwordMax);

export const newPasswordField = z
	.string()
	.min(publicEnv.passwordMinLength)
	.max(ACCOUNT_LIMITS.passwordMax);

export const emailInputSchema = z.object({ email: emailField });

export const loginInputSchema = z.object({
	email: emailField,
	// Un mot de passe trop court reste une tentative ratée, pas une erreur de
	// validation qui contournerait le limiteur.
	password: currentPasswordField,
	next: z.string().trim().max(2048).optional()
});

export const changePasswordInputSchema = z.object({
	currentPassword: currentPasswordField,
	newPassword: newPasswordField,
	confirm: z.string().min(1).max(ACCOUNT_LIMITS.passwordMax)
});

export const resetPasswordInputSchema = z.object({
	token: z.string().trim().min(1).max(512),
	password: newPasswordField,
	confirm: z.string().min(1).max(ACCOUNT_LIMITS.passwordMax)
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
