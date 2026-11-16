import type { RosterTemplate } from '#config/roster.ts';
import { rosterTemplateSchema } from '#config/roster.ts';
import type { SettingsValues } from '#config/settings-registry.ts';
import type { GeneratorPlayer } from '#lib/domain/teams/generator.ts';
import { requireCompleteRatings } from '#lib/domain/ratings/overall.ts';
import { generationCandidates } from '#lib/domain/players/candidates.ts';
import { getSettings } from '#lib/domain/settings/service.ts';
import { claimsForGeneration } from '#lib/domain/subs/generation.ts';
import { AppError } from '#lib/shared/errors.ts';
import { listAvailability } from './queries.ts';
import type { GameRow } from './schema.ts';
import { selectPool, type BenchPlayer, type SelectedPlayer } from './selection.ts';

export type LineupPool = {
	selected: SelectedPlayer[];
	bench: BenchPlayer[];
	players: GeneratorPlayer[];
	kindOf: Map<string, 'regular' | 'sub'>;
	settings: SettingsValues;
};

export function templateFromRow(row: GameRow): RosterTemplate {
	try {
		return rosterTemplateSchema.parse(JSON.parse(row.rosterTemplateJson));
	} catch (cause) {
		throw new AppError('INTERNAL', {
			message: 'Invalid roster template snapshot',
			cause
		});
	}
}

/**
 * Une seule construction du bassin: les présents, les remplaçants réclamés,
 * les notes complètes et le banc. Le générateur et les actions d'alignement
 * lisent tous ce même bassin.
 */
export function buildLineupPool(gameId: string, template: RosterTemplate): LineupPool {
	const settings = getSettings();
	const { selected, bench } = selectPool({
		template,
		players: generationCandidates().map((player) => ({
			playerId: player.userId,
			position: player.position,
			age: player.age,
			isSubstitute: player.isSubstitute,
			active: player.active
		})),
		availability: listAvailability(gameId),
		claims: claimsForGeneration(gameId)
	});
	const overalls = requireCompleteRatings(selected.map((player) => player.playerId));

	return {
		selected,
		bench,
		players: selected.map((player) => ({
			id: player.playerId,
			position: player.position,
			age: player.age,
			overall: overalls.get(player.playerId) ?? 0,
			kind: player.kind
		})),
		kindOf: new Map(selected.map((player) => [player.playerId, player.kind])),
		settings
	};
}
