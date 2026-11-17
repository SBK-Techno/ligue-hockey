/**
 * L'ordre des sections de la page d'un match. Un match terminé répond d'abord
 * « quel est le résultat »; un match à venir répond d'abord « qu'est-ce que je
 * dois faire ». La page rend cet ordre tel quel, sans le recomposer.
 */
export type MatchSection = 'attendance' | 'substitutes' | 'sheet' | 'lineup';

export type MatchSectionState = {
	completed: boolean;
	hasAttendance: boolean;
	hasSubstitutes: boolean;
	hasSheet: boolean;
	hasLineup: boolean;
};

export function matchSectionOrder(state: MatchSectionState): MatchSection[] {
	const order: MatchSection[] = [];
	if (state.completed) {
		if (state.hasSheet) order.push('sheet');
		if (state.hasLineup) order.push('lineup');
		if (state.hasSubstitutes) order.push('substitutes');
		return order;
	}
	if (state.hasAttendance) order.push('attendance');
	if (state.hasSubstitutes) order.push('substitutes');
	if (state.hasSheet) order.push('sheet');
	if (state.hasLineup) order.push('lineup');
	return order;
}
