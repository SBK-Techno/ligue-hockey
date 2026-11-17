import { t } from '#lib/shared/i18n/index.ts';

/**
 * La ligne d'équilibre ne montre que les écarts réellement mesurés. Un écart
 * de notes nul (notes incomplètes) disparaît au lieu de laisser un libellé
 * suspendu; l'écart d'âge, lui, reste toujours calculable.
 */
export function balanceLine(
	skill: string | null,
	age: string | null
): string {
	const parts: string[] = [];
	if (skill !== null && skill !== '') {
		parts.push(t('games.balanceSkill', { value: skill }));
	}
	if (age !== null && age !== '') {
		parts.push(t('games.balanceAge', { value: age }));
	}
	return parts.join(' · ');
}
