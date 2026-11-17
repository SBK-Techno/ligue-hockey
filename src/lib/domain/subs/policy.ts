import type { Position } from '#config/positions.ts';
import { gameStartsAt } from '#lib/domain/games/schedule.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export type SubRequestWaveInput = {
	gameStartMs: number;
	nowMs: number;
	generalLeadHours: number;
	priorityGapHours: number;
	lastCallMinutes: number;
};

/**
 * Un remplaçant peut toujours prendre sa position principale, même s'il n'a
 * jamais enregistré de préférences. La règle vit ici pour que l'affichage et
 * le service de réclamation répondent la même chose.
 */
export function claimablePositions(
	saved: readonly Position[],
	primary: Position | null
): Position[] {
	if (saved.length > 0) return [...saved];
	return primary ? [primary] : [];
}

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
	// Les favoris gardent leur avance même quand la demande arrive tard :
	// la vague générale est repoussée, sans jamais dépasser le dernier appel.
	const generalAt = clamp(
		Math.max(generalTarget, favoriteAt + input.priorityGapHours * HOUR),
		favoriteAt,
		latest
	);

	return { favoriteAt, generalAt };
}

export function isTooLateForSubRequest(
	gameStartMs: number,
	nowMs: number,
	lastCallMinutes: number
): boolean {
	return nowMs >= gameStartMs - lastCallMinutes * MINUTE;
}

export type OpenRequestOrder = {
	game: { gameDate: string; startTime: string };
	createdAt: number;
};

/**
 * L'ordre du bassin ouvert : le match le plus proche d'abord, puis la demande
 * la plus ancienne. L'ordre ne dépend donc plus de l'ordre d'insertion.
 */
export function compareOpenRequests(
	a: OpenRequestOrder,
	b: OpenRequestOrder
): number {
	return gameStartsAt(a.game) - gameStartsAt(b.game) || a.createdAt - b.createdAt;
}
