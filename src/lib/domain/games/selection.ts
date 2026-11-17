import { POSITIONS, comparePositionThenKind, positionRank, type Position } from '#config/positions.ts';
import { slotCounts, type RosterTemplate } from '#config/roster.ts';
import { TEAMS } from '#config/teams.ts';

export type BenchPlayer = {
	playerId: string;
	position: Position;
	kind: 'regular' | 'sub';
};

/**
 * Un membre vivant du bassin : présent ou remplaçant réclamé. Ses postes
 * éligibles viennent de sa position native ou de sa liste de réclamations.
 */
export type SelectionCandidate = {
	playerId: string;
	position: Position;
	eligiblePositions: readonly Position[];
	kind: 'regular' | 'sub';
	order: number;
};

export type SelectedCandidate<T extends SelectionCandidate> = T & {
	selectionPosition: Position;
};

export type GenerationSelection<T extends SelectionCandidate> = {
	selected: SelectedCandidate<T>[];
	bench: T[];
};

/**
 * Choisit au plus la capacité de chaque poste dans les membres vivants. Les
 * remplaçants réclamés passent avant les réguliers, puis le reste forme le
 * banc. C'est la seule sélection de capacité : le générateur et le bassin
 * d'alignement partent des mêmes membres.
 */
export function selectGenerationPlayers<T extends SelectionCandidate>(
	members: readonly T[],
	template: RosterTemplate
): GenerationSelection<T> {
	const counts = slotCounts(template);
	const capacity = new Map<Position, number>();
	for (const position of POSITIONS) {
		capacity.set(position.key, counts[position.key] * TEAMS.length);
	}

	const ordered = [...members].sort(
		(a, b) => a.order - b.order || a.playerId.localeCompare(b.playerId)
	);
	const selected: SelectedCandidate<T>[] = [];
	const seen = new Set<string>();

	for (const member of ordered) {
		if (member.kind !== 'sub') continue;
		if (seen.has(member.playerId)) continue;
		const position = member.eligiblePositions.find(
			(candidate) => (capacity.get(candidate) ?? 0) > 0
		);
		if (!position) continue;
		capacity.set(position, (capacity.get(position) ?? 0) - 1);
		seen.add(member.playerId);
		selected.push({ ...member, selectionPosition: position });
	}

	for (const member of ordered) {
		if (member.kind !== 'regular') continue;
		if (seen.has(member.playerId)) continue;
		if ((capacity.get(member.position) ?? 0) <= 0) continue;
		capacity.set(member.position, (capacity.get(member.position) ?? 0) - 1);
		seen.add(member.playerId);
		selected.push({ ...member, selectionPosition: member.position });
	}

	const bench = members
		.filter((member) => !seen.has(member.playerId))
		.sort(
			(a, b) =>
				comparePositionThenKind(a, b) ||
				a.order - b.order ||
				a.playerId.localeCompare(b.playerId)
		);

	selected.sort(
		(a, b) =>
			positionRank(a.selectionPosition) - positionRank(b.selectionPosition) ||
			a.playerId.localeCompare(b.playerId)
	);

	return { selected, bench };
}
