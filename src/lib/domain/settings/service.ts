import {
	parseSettings,
	SETTINGS,
	SETTINGS_KEYS,
	SettingsError,
	isSettingsKey,
	type SettingValue,
	type SettingsKey,
	type SettingsValues
} from '#config/settings-registry.ts';
import { requirePermission } from '#lib/domain/auth/policy.ts';
import type { Actor } from '#lib/domain/auth/types.ts';
import { recordAudit } from '#lib/domain/audit/service.ts';
import { AppError } from '#lib/shared/errors.ts';
import { clock } from '#lib/shared/time/clock.ts';
import { listSettings, saveSettings } from './queries.ts';

let cached: SettingsValues | null = null;

function decodeRows(rows: readonly { key: string; valueJson: string }[]) {
	const input: Record<string, unknown> = {};
	const unknown: string[] = [];

	for (const row of rows) {
		if (!isSettingsKey(row.key)) {
			unknown.push(row.key);
			continue;
		}

		try {
			input[row.key] = JSON.parse(row.valueJson);
		} catch (cause) {
			throw new AppError('INTERNAL', {
				message: `Invalid JSON for setting ${row.key}`,
				cause
			});
		}
	}

	if (unknown.length > 0) {
		throw new AppError('INTERNAL', {
			message: `Unknown persisted settings: ${unknown.join(', ')}`
		});
	}

	return input;
}

export function getSettings(): SettingsValues {
	if (cached) return cached;
	cached = parseSettings(decodeRows(listSettings()));
	return cached;
}

export function getSetting<K extends SettingsKey>(key: K): SettingValue<K> {
	return getSettings()[key];
}

export function invalidateSettingsCache(): void {
	cached = null;
}

export function updateSettings(
	actor: Actor,
	input: Readonly<Record<string, unknown>>
): SettingsValues {
	requirePermission(actor, 'manageSettings');

	const unknown = Object.keys(input).filter((key) => !isSettingsKey(key));
	if (unknown.length > 0) {
		throw new AppError('VALIDATION', {
			details: unknown.map((key) => ({ path: key, code: 'unknown_setting' }))
		});
	}

	const merged = { ...getSettings(), ...input };
	let parsed: SettingsValues;
	try {
		parsed = parseSettings(merged);
	} catch (cause) {
		if (cause instanceof SettingsError) {
			throw new AppError('VALIDATION', {
				key: cause.invariantKey ?? 'error.validation',
				details: cause.issues
			});
		}
		throw cause;
	}
	const now = clock.nowMs();
	const changed = SETTINGS_KEYS.filter((key) => key in input);

	saveSettings(
		changed.map((key) => ({
			key,
			valueJson: JSON.stringify(parsed[key]),
			updatedAt: now,
			updatedBy: actor.kind === 'user' ? actor.userId : null
		}))
	);

	cached = parsed;
	recordAudit(actor, {
		action: 'settings.update',
		entityType: 'settings',
		metadata: { keys: changed }
	});

	return parsed;
}

export { SETTINGS };
