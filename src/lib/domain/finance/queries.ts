import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { paymentPlans, payments, type PaymentPlanRow, type PaymentRow } from './schema.ts';

export function findPlan(playerId: string): PaymentPlanRow | undefined {
	return db
		.select()
		.from(paymentPlans)
		.where(eq(paymentPlans.playerId, playerId))
		.get();
}

export function listPlans(): PaymentPlanRow[] {
	return db.select().from(paymentPlans).all();
}

export function upsertPlan(row: typeof paymentPlans.$inferInsert): void {
	db.insert(paymentPlans)
		.values(row)
		.onConflictDoUpdate({
			target: paymentPlans.playerId,
			set: {
				totalCents: row.totalCents,
				firstCents: row.firstCents,
				secondCents: row.secondCents,
				firstDueDate: row.firstDueDate,
				secondDueDate: row.secondDueDate,
				updatedAt: row.updatedAt
			}
		})
		.run();
}

export function listPayments(playerId: string): PaymentRow[] {
	return db
		.select()
		.from(payments)
		.where(eq(payments.playerId, playerId))
		.orderBy(asc(payments.paidAt))
		.all();
}

export function listAllPayments(): PaymentRow[] {
	return db.select().from(payments).orderBy(asc(payments.paidAt)).all();
}

export function findPayment(id: string): PaymentRow | undefined {
	return db.select().from(payments).where(eq(payments.id, id)).get();
}

export function insertPayment(row: typeof payments.$inferInsert): void {
	db.insert(payments).values(row).run();
}

export function deletePayment(id: string): void {
	db.delete(payments).where(eq(payments.id, id)).run();
}
