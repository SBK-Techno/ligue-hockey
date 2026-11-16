import {
	SETTINGS,
	SETTINGS_KEYS,
	type SettingsKey,
	type SettingsValues
} from '#config/settings-registry.ts';
import { AppError } from '#lib/shared/errors.ts';
import { centsToInput, parseMoneyToCents } from '#lib/shared/i18n/index.ts';

export type SettingsFormValues = Record<string, string | boolean>;

export function settingsFormValues(values: SettingsValues): SettingsFormValues {
	const output: SettingsFormValues = {};
	for (const key of SETTINGS_KEYS) {
		const definition = SETTINGS[key];
		const value = values[key];
		if (definition.kind === 'boolean') {
			output[key] = value as boolean;
		} else if (definition.kind === 'money') {
			output[key] = centsToInput(value as number);
		} else {
			output[key] = value === null ? '' : String(value);
		}
	}
	return output;
}

function fieldText(formData: FormData, key: SettingsKey): string {
	const value = formData.get(key);
	return typeof value === 'string' ? value.trim() : '';
}

export function settingsInputFromFormData(
	formData: FormData
): Record<string, unknown> {
	const output: Record<string, unknown> = {};

	for (const key of SETTINGS_KEYS) {
		const definition = SETTINGS[key];
		const raw = fieldText(formData, key);

		switch (definition.kind) {
			case 'boolean':
				output[key] = formData.get(key) === 'on';
				break;
			case 'number':
				output[key] = raw === '' ? NaN : Number(raw);
				break;
			case 'money': {
				const cents = parseMoneyToCents(raw);
				if (cents === null) {
					throw new AppError('VALIDATION', { key: 'balance.amountInvalid' });
				}
				output[key] = cents;
				break;
			}
			case 'date':
				output[key] = raw === '' ? null : raw;
				break;
			default:
				output[key] = raw;
		}
	}

	return output;
}
