import { z } from 'zod';
import { POSITIONS, type Position } from './positions.ts';
import { settingBound, type SettingsValues } from './settings-registry.ts';
import { TEAMS, type Team } from './teams.ts';

/** Les bornes dures du modèle, dérivées des réglages, sans recopie. */
const goaliesMax = settingBound('roster.goaliesPerTeam', 'max');
const forwardsMax = settingBound('roster.forwardsPerTeam', 'max');
const defenseMax = settingBound('roster.defensePerTeam', 'max');
const maxSlotsPerTeam = goaliesMax + forwardsMax + defenseMax;

export const ROSTER_LIMITS = {
	goaliesPerTeam: goaliesMax,
	forwardsPerTeam: forwardsMax,
	defensePerTeam: defenseMax,
	maxSlotsPerTeam,
	maxSlotIndex: Math.max(goaliesMax, forwardsMax, defenseMax) - 1,
	/** Deux équipes, toutes positions confondues. */
	maxAssignments: maxSlotsPerTeam * TEAMS.length
} as const;

export const rosterTemplateSchema = z.object({
	goaliesPerTeam: z.number().int().min(0).max(ROSTER_LIMITS.goaliesPerTeam),
	forwardsPerTeam: z.number().int().min(0).max(ROSTER_LIMITS.forwardsPerTeam),
	defensePerTeam: z.number().int().min(0).max(ROSTER_LIMITS.defensePerTeam)
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


export function totalSlots(template: RosterTemplate): number {
	const counts = slotCounts(template);
	return (
		(counts.forward + counts.defense + counts.goalie) * TEAMS.length
	);
}
