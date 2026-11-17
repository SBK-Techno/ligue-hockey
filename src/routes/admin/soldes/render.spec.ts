import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { AdminBalanceRow } from '#lib/domain/finance/service.ts';
import Page from './+page.svelte';

function installment(number: 1 | 2, amountCents: number) {
	return {
		number,
		amountCents,
		paidCents: 0,
		remainingCents: amountCents,
		dueDate: '2026-11-01',
		paidAt: null,
		status: 'upcoming' as const
	};
}

function balance(overrides: Partial<AdminBalanceRow>): AdminBalanceRow {
	return {
		playerId: 'player',
		playerName: 'Joueur Test',
		currency: 'CAD',
		planActive: true,
		status: 'upcoming',
		totalCents: 24000,
		paidCents: 0,
		outstandingCents: 24000,
		overdueCents: 0,
		isOverdue: false,
		installments: [installment(1, 12000), installment(2, 12000)],
		active: true,
		hasPlan: true,
		...overrides
	};
}

const balances = [
	balance({
		playerId: 'overdue',
		playerName: 'Retard Test',
		status: 'overdue',
		isOverdue: true,
		overdueCents: 24000
	}),
	balance({
		playerId: 'partial',
		playerName: 'Partiel Test',
		status: 'partial',
		paidCents: 12000,
		outstandingCents: 12000
	}),
	balance({
		playerId: 'paid',
		playerName: 'Payé Test',
		status: 'paid',
		paidCents: 24000,
		outstandingCents: 0
	})
];

const layout = {
	actor: {
		kind: 'user' as const,
		active: true,
		userId: 'manager',
		name: 'Gérant',
		role: 'manager' as const
	},
	unread: 0,
	hasPlayerProfile: true,
	isSubstitute: false,
	avatarId: null,
	peekScope: 'public' as const,
	nav: {
		primary: [],
		mobile: [],
		account: null,
		roleLabelKey: 'admin.role.manager' as const,
		unreadCap: 9 as const
	}
};

function renderPage() {
	return render(Page, {
		props: {
			data: {
				...layout,
				balances,
				currency: 'CAD',
				totals: { total: 72000, paid: 36000, outstanding: 36000, overdue: 1 }
			},
			form: null,
			params: {}
		}
	});
}

describe('soldes', () => {
	it('s’ouvre sur les montants à payer, pas sur les joueurs à jour', () => {
		const { body } = renderPage();

		expect(body).toContain('Retard Test');
		expect(body).toContain('Partiel Test');
		expect(body).not.toContain('Payé Test');
	});

	it('affiche le compte de chaque filtre et le total des joueurs', () => {
		const { body } = renderPage();

		expect(body).toMatch(/Tous[\s\S]{0,120}>3</);
		expect(body).toMatch(/En retard[\s\S]{0,120}>1</);
		expect(body).toMatch(/Montant à payer[\s\S]{0,120}>2</);
		expect(body).toMatch(/Sans versements[\s\S]{0,120}>0</);
	});
});
