import type { Actions, ServerLoad } from '@sveltejs/kit';
import { CURRENCY } from '#config/currency.ts';
import {
	SETTINGS,
	SETTING_GROUPS,
	SETTINGS_KEYS,
	type SettingsKey
} from '#config/settings-registry.ts';
import { getSettings, updateSettings } from '#lib/domain/settings/service.ts';
import { settingDescription } from '#lib/domain/settings/descriptions.ts';
import { settingsFormValues, settingsInputFromFormData } from '#lib/domain/settings/form.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import { actionError, loadError } from '#lib/server/action.ts';
import { isAppError } from '#lib/shared/errors.ts';
import { t } from '#lib/shared/i18n/index.ts';

export const load: ServerLoad = ({ locals }) => {
	const actor = locals.actor;
	try {
		requirePermission(actor, 'manageSettings');
	} catch (cause) {
		return loadError(cause);
	}

	const values = getSettings();
	const descriptions: Record<string, string> = {};
	for (const key of SETTINGS_KEYS) {
		descriptions[key] = settingDescription(key, values);
	}

	return {
		groups: SETTING_GROUPS.map((group) => ({
			...group,
			settings: SETTINGS_KEYS.filter(
				(key) => SETTINGS[key].group === group.key
			).map((key) => ({
				key,
				kind: SETTINGS[key].kind,
				labelKey: SETTINGS[key].labelKey,
				min: SETTINGS[key].min,
				max: SETTINGS[key].max,
				step: SETTINGS[key].step,
				options: SETTINGS[key].options ?? []
			}))
		})),
		values: settingsFormValues(values),
		descriptions,
		currency: CURRENCY
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		try {
			const input = settingsInputFromFormData(await request.formData());
			updateSettings(locals.actor, input as Record<SettingsKey, unknown>);
			return { ok: true, message: t('admin.settingsSaved') };
		} catch (cause) {
			return actionError(cause, { setting: failingSetting(cause) });
		}
	}
};

function failingSetting(cause: unknown): string | null {
	if (!isAppError(cause)) return null;
	const details = cause.details as Array<{ path?: string }> | undefined;
	return details?.find((entry) => entry.path)?.path ?? null;
}
