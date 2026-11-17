/**
 * L'ordre des sections de la page d'un match. Une feuille existe seulement
 * quand le match a commencé : elle répond alors d'abord « quel est le score ».
 * Un match à venir répond d'abord « qui sera là », puis les remplaçants.
 * L'alignement appartient à la section Équipes et n'est jamais dupliqué ici.
 */
export type MatchSection = 'attendance' | 'substitutes' | 'sheet';

export type MatchSectionState = {
	completed: boolean;
	hasAttendance: boolean;
	hasSubstitutes: boolean;
	hasSheet: boolean;
};

export function matchSectionOrder(state: MatchSectionState): MatchSection[] {
	const order: MatchSection[] = [];
	if (state.completed || state.hasSheet) {
		if (state.hasSheet) order.push('sheet');
		if (state.hasSubstitutes) order.push('substitutes');
		return order;
	}
	if (state.hasAttendance) order.push('attendance');
	if (state.hasSubstitutes) order.push('substitutes');
	return order;
}
