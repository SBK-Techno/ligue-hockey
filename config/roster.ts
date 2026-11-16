import { z } from 'zod';
import { POSITIONS, type Position } from './positions.ts';
import type { SettingsValues } from './settings-registry.ts';
import { TEAMS, type Team } from './teams.ts';

export const rosterTemplateSchema = z.object({
	goaliesPerTeam: z.number().int().min(0).max(3),
	forwardsPerTeam: z.number().int().min(0).max(8),
	defensePerTeam: z.number().int().min(0).max(8)
});

export type RosterTemplate = z.infer<typeof rosterTemplateSchema>;

export type SlotDefinition = {
	team: Team;
	position: Position;
	index: number;
};

export function rosterTemplateFromSettings(
	settings: SettingsValues
): RosterTemplate {
	return {
		goaliesPerTeam: settings['roster.goaliesPerTeam'],
		forwardsPerTeam: settings['roster.forwardsPerTeam'],
		defensePerTeam: settings['roster.defensePerTeam']
	};
}

export function slotCounts(template: RosterTemplate): Record<Position, number> {
	return {
		forward: template.forwardsPerTeam,
		defense: template.defensePerTeam,
		goalie: template.goaliesPerTeam
	};
}

export function buildSlotDefinitions(
	template: RosterTemplate
): SlotDefinition[] {
	const counts = slotCounts(template);
	const slots: SlotDefinition[] = [];

	for (const team of TEAMS) {
		for (const position of POSITIONS) {
			for (let index = 0; index < counts[position.key]; index += 1) {
				slots.push({ team: team.key, position: position.key, index });
			}
		}
	}

	return slots;
}

export function slotId(
	gameId: string,
	slot: Pick<SlotDefinition, 'team' | 'position' | 'index'>
): string {
	return `${gameId}:${slot.team}:${slot.position}:${slot.index}`;
}

export function totalSlots(template: RosterTemplate): number {
	const counts = slotCounts(template);
	return (
		(counts.forward + counts.defense + counts.goalie) * TEAMS.length
	);
}
