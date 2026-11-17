/**
 * L'ordre des sections de la page d'un match. Une feuille existe seulement
 * quand le match a commencé : elle répond alors d'abord « quel est le score ».
 * Un match à venir répond d'abord « où je joue », puis « qui sera là », puis
 * les remplaçants. La page rend cet ordre tel quel, sans le recomposer.
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
	if (state.completed || state.hasSheet) {
		if (state.hasSheet) order.push('sheet');
		if (state.hasLineup) order.push('lineup');
		if (state.hasSubstitutes) order.push('substitutes');
		return order;
	}
	if (state.hasLineup) order.push('lineup');
	if (state.hasAttendance) order.push('attendance');
	if (state.hasSubstitutes) order.push('substitutes');
	return order;
}
