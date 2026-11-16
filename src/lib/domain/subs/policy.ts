const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type SubRequestWaveInput = {
	gameStartMs: number;
	nowMs: number;
	generalLeadHours: number;
	priorityGapHours: number;
	lastCallMinutes: number;
};

export type SubRequestWaves = {
	favoriteAt: number;
	generalAt: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function computeSubRequestWaves(
	input: SubRequestWaveInput
): SubRequestWaves {
	const earliest = input.nowMs + MINUTE;
	const latest = Math.max(
		earliest,
		input.gameStartMs - input.lastCallMinutes * MINUTE
	);

	const favoriteTarget =
		input.gameStartMs -
		(input.generalLeadHours + input.priorityGapHours) * HOUR;
	const generalTarget = input.gameStartMs - input.generalLeadHours * HOUR;

	const favoriteAt = clamp(favoriteTarget, earliest, latest);
	const generalAt = clamp(generalTarget, favoriteAt, latest);

	return { favoriteAt, generalAt };
}

export function isTooLateForSubRequest(
	gameStartMs: number,
	nowMs: number,
	lastCallMinutes: number
): boolean {
	return nowMs >= gameStartMs - lastCallMinutes * MINUTE;
}
