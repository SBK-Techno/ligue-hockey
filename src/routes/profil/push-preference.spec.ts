import { describe, expect, it } from 'vitest';
import { pushPreferenceState, type PushDeviceStatus } from './push-preference.ts';

describe('état de la préférence de notification', () => {
	const cases: Array<{
		device: PushDeviceStatus;
		saved: boolean;
		checked: boolean;
		disabled: boolean;
		hint: boolean;
	}> = [
		{ device: 'on', saved: true, checked: true, disabled: false, hint: false },
		{ device: 'on', saved: false, checked: false, disabled: false, hint: false },
		{ device: 'off', saved: true, checked: false, disabled: true, hint: true },
		{ device: 'off', saved: false, checked: false, disabled: true, hint: true },
		{ device: 'denied', saved: true, checked: false, disabled: true, hint: true },
		{ device: 'unsupported', saved: true, checked: false, disabled: true, hint: true },
		{ device: 'unconfigured', saved: true, checked: false, disabled: true, hint: true },
		{ device: 'checking', saved: true, checked: false, disabled: true, hint: true }
	];

	for (const entry of cases) {
		it(`${entry.device}, préférence ${entry.saved ? 'active' : 'inactive'}`, () => {
			expect(pushPreferenceState(entry.device, entry.saved)).toEqual({
				checked: entry.checked,
				disabled: entry.disabled,
				hint: entry.hint
			});
		});
	}
});
