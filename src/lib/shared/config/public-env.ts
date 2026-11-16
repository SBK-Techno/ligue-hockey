import { VAPID_PUBLIC_KEY, PASSWORD_MIN_LENGTH } from '$app/env/public';

export const publicEnv = Object.freeze({
	vapidPublicKey: VAPID_PUBLIC_KEY || null,
	passwordMinLength: PASSWORD_MIN_LENGTH
});
