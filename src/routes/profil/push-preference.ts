/**
 * L'état de la préférence d'envoi sur l'appareil. La préférence enregistrée
 * reste séparée de l'abonnement réel : la case ne peut pas dire « activé »
 * quand l'appareil n'a aucune inscription active.
 */
export type PushDeviceStatus =
	| 'checking'
	| 'off'
	| 'on'
	| 'denied'
	| 'unsupported'
	| 'unconfigured'
	| 'unavailable';

export type PushPreferenceState = {
	checked: boolean;
	disabled: boolean;
	/** Vrai quand l'appareil doit d'abord être activé pour que la case agisse. */
	hint: boolean;
};

export function pushPreferenceState(
	device: PushDeviceStatus,
	saved: boolean
): PushPreferenceState {
	const active = device === 'on';
	return {
		checked: active && saved,
		disabled: !active,
		hint: !active
	};
}
