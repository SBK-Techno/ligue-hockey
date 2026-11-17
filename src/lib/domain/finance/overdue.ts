import { computeBalance, planIsActive, type Payment, type PaymentPlan } from './policy.ts';

/**
 * Un avis de retard par joueur et par versement. La clé de dédoublonnage
 * ajoute la date d'échéance : une nouvelle saison ou un nouveau plan produit
 * donc un nouvel avis, alors qu'un balayage répété ne renvoie rien.
 */
export type OverdueNotice = {
	playerId: string;
	installment: 1 | 2;
	amountCents: number;
	dueDate: string;
};

export type OverdueCandidate = {
	playerId: string;
	plan: PaymentPlan | null;
	payments: readonly Payment[];
};

/**
 * La transition « pas encore en retard » vers « en retard » est lue dans le
 * même calcul que le solde affiché : un versement n'est signalé que lorsque
 * son restant est réellement dû et que sa date, marge comprise, est passée.
 */
export function overdueNotices(
	candidates: readonly OverdueCandidate[],
	today: string,
	graceDays: number
): OverdueNotice[] {
	const notices: OverdueNotice[] = [];

	for (const candidate of candidates) {
		const plan = candidate.plan;
		if (plan === null || !planIsActive(plan)) continue;
		const balance = computeBalance(plan, candidate.payments, today, graceDays);
		for (const installment of balance.installments) {
			if (
				installment.status !== 'overdue' ||
				installment.remainingCents <= 0 ||
				installment.dueDate === null
			) {
				continue;
			}
			notices.push({
				playerId: candidate.playerId,
				installment: installment.number,
				amountCents: installment.remainingCents,
				dueDate: installment.dueDate
			});
		}
	}

	return notices;
}
