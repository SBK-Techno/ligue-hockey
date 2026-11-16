import { POSITION_KEYS, type Position } from '#config/positions.ts';
import {
	buildSlotDefinitions,
	type RosterTemplate
} from '#config/roster.ts';

export type PoolPlayer = {
	playerId: string;
	position: Position;
	age: number;
	isSubstitute: boolean;
	active: boolean;
};

export type PoolAvailability = {
	playerId: string;
	status: 'present' | 'absent';
	updatedAt: number;
};

export type PoolClaim = {
	playerId: string;
	position: Position;
	filledAt: number | null;
};

export type SelectedPlayer = {
	playerId: string;
	position: Position;
	age: number;
	kind: 'regular' | 'sub';
	order: number;
};

export type BenchPlayer = {
	playerId: string;
	position: Position;
	kind: 'regular' | 'sub';
};

export type PoolSelection = {
	selected: SelectedPlayer[];
	bench: BenchPlayer[];
};

export function selectPool(input: {
	template: RosterTemplate;
	players: readonly PoolPlayer[];
	availability: readonly PoolAvailability[];
	claims: readonly PoolClaim[];
}): PoolSelection {
	const players = new Map(input.players.map((player) => [player.playerId, player]));
	const availability = new Map(
		input.availability
			.filter((row) => row.status === 'present')
			.map((row) => [row.playerId, row.updatedAt])
	);
	const slots = buildSlotDefinitions(input.template);
	const capacity = new Map<Position, number>();
	for (const position of POSITION_KEYS) {
		capacity.set(
			position,
			slots.filter((slot) => slot.position === position).length
		);
	}

	const selected: SelectedPlayer[] = [];
	const bench: BenchPlayer[] = [];
	const seen = new Set<string>();

	for (const position of POSITION_KEYS) {
		const positionCapacity = capacity.get(position) ?? 0;
		const positionClaims = input.claims
			.filter(
				(claim) =>
					claim.position === position &&
					players.get(claim.playerId)?.active === true
			)
			.sort(
				(a, b) =>
					(a.filledAt ?? 0) - (b.filledAt ?? 0) ||
					a.playerId.localeCompare(b.playerId)
			);
		const claimed = positionClaims.slice(0, positionCapacity);
		const extraClaims = positionClaims.slice(positionCapacity);

		const regulars = [...availability.entries()]
			.map(([playerId, order]) => ({
				player: players.get(playerId),
				order
			}))
			.filter(
				(entry): entry is { player: PoolPlayer; order: number } =>
					!!entry.player &&
					entry.player.active &&
					!entry.player.isSubstitute &&
					entry.player.position === position
			)
			.sort(
				(a, b) =>
					a.order - b.order ||
					a.player.playerId.localeCompare(b.player.playerId)
			);

		const regularCapacity = Math.max(0, positionCapacity - claimed.length);
		const selectedRegulars = regulars.slice(0, regularCapacity);
		const extraRegulars = regulars.slice(regularCapacity);

		for (const entry of selectedRegulars) {
			if (seen.has(entry.player.playerId)) continue;
			seen.add(entry.player.playerId);
			selected.push({
				playerId: entry.player.playerId,
				position,
				age: entry.player.age,
				kind: 'regular',
				order: entry.order
			});
		}

		for (const claim of claimed) {
			if (seen.has(claim.playerId)) {
				bench.push({ playerId: claim.playerId, position, kind: 'sub' });
				continue;
			}
			const player = players.get(claim.playerId);
			if (!player) continue;
			seen.add(claim.playerId);
			selected.push({
				playerId: claim.playerId,
				position,
				age: player.age,
				kind: 'sub',
				order: claim.filledAt ?? 0
			});
		}

		for (const entry of extraRegulars) {
			if (seen.has(entry.player.playerId)) continue;
			bench.push({ playerId: entry.player.playerId, position, kind: 'regular' });
		}

		for (const claim of extraClaims) {
			if (seen.has(claim.playerId)) continue;
			bench.push({ playerId: claim.playerId, position, kind: 'sub' });
		}
	}

	return { selected, bench };
}
